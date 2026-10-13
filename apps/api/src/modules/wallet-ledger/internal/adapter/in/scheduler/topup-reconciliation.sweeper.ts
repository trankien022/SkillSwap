import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ApiConfig } from '../../../../../../shared/config/api-config';
import { AppLogger } from '../../../../../../shared/logger/app-logger';
import {
  HANDLE_TOP_UP_CALLBACK,
  type HandleTopUpCallbackPort,
} from '../../../application/port/in/handle-top-up-callback';
import type { TopUpIntentRepository } from '../../../application/port/out/top-up-intent-repository';
import { TOP_UP_INTENT_REPOSITORY } from '../../../application/port/out/top-up-intent-repository';
import {
  SEPAY_ORDER_CLIENT,
  type SepayOrderClient,
} from '../../../application/port/out/sepay-order-client';

/** How many stale intents one pass re-queries, so a backlog cannot stampede SePay. */
export const RECON_BATCH_SIZE = 25;

/**
 * FR-008 / ADR-033 reconciliation: a **stub**, and deliberately a limited one.
 *
 * What it does: finds intents still `pending` after `SEPAY_RECON_MIN_AGE_MS`,
 * asks the provider for the order behind each one, and feeds the answer through
 * `HandleTopUpCallbackUseCase` — the same path an IPN takes, so the
 * exactly-once credit rule is not reimplemented here.
 *
 * What it does **not** do, and why the ADR keeps the risk note:
 *  - it is **disabled by default** (`SEPAY_RECON_ENABLED=false`), so no dev,
 *    test or CI run calls SePay;
 *  - it cannot backfill an outage where the intent row itself was never written;
 *  - it performs no manual resolution and no alerting beyond a log line;
 *  - a `failed` or `reversed` answer it applies is not reviewed by a human.
 *
 * It exists so the gap is a visible, testable code path rather than a promise.
 */
@Injectable()
export class TopUpReconciliationSweeper implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    @Inject(TOP_UP_INTENT_REPOSITORY) private readonly intents: TopUpIntentRepository,
    @Inject(SEPAY_ORDER_CLIENT) private readonly orders: SepayOrderClient,
    @Inject(HANDLE_TOP_UP_CALLBACK) private readonly applyCallback: HandleTopUpCallbackPort,
    private readonly config: ApiConfig,
    private readonly logger: AppLogger,
  ) {}

  onModuleInit(): void {
    if (!this.config.sepayReconEnabled) {
      this.logger
        .child('topup-recon')
        .log({ enabled: false }, 'Top-up reconciliation is disabled (SEPAY_RECON_ENABLED)');
      return;
    }
    this.timer = setInterval(() => void this.run(), this.config.sepayReconIntervalMs);
    // Never keep the process alive for a background sweep.
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /** One pass. Returns how many intents were moved by a provider answer. */
  async run(): Promise<number> {
    if (!this.config.sepayReconEnabled || this.running) return 0;
    this.running = true;
    try {
      const stale = await this.intents.findStalePending(
        this.config.sepayReconMinAgeMs,
        RECON_BATCH_SIZE,
      );

      let applied = 0;
      for (const intent of stale) {
        try {
          const order = await this.orders.findByInvoiceNumber(intent.providerRef);
          if (order === null || order.status === 'pending') continue;

          const result = await this.applyCallback.execute({
            providerRef: order.providerRef,
            amountVnd: intent.amountVnd,
            status: order.status,
            providerOrderId: order.providerOrderId,
            paidAmountVnd: order.paidAmountVnd,
            paidAt: order.paidAt,
          });
          if (result.applied) applied += 1;
        } catch (error) {
          // One bad order must not abandon the rest of the batch.
          this.logger
            .child('topup-recon')
            .error(error, `Reconciliation failed for invoice ${intent.providerRef}`);
        }
      }

      if (stale.length > 0) {
        this.logger
          .child('topup-recon')
          .log({ scanned: stale.length, applied }, 'Top-up reconciliation pass complete');
      }
      return applied;
    } catch (error) {
      this.logger.child('topup-recon').error(error, 'Top-up reconciliation pass failed');
      return 0;
    } finally {
      this.running = false;
    }
  }
}
