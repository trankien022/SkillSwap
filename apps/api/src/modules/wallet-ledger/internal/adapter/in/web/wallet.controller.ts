import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type {
  SepayIpnAck,
  TopUpIntentCreated,
  TopUpIntentStatusView,
  WalletBalanceView,
  WalletHistoryPage,
} from '@skillswap/contracts';
import {
  INITIATE_TOP_UP,
  type InitiateTopUpPort,
} from '../../../application/port/in/initiate-top-up';
import {
  GET_TOP_UP_INTENT,
  type GetTopUpIntentPort,
} from '../../../application/port/in/get-top-up-intent';
import {
  GET_WALLET_BALANCE,
  type GetWalletBalancePort,
} from '../../../application/port/in/get-wallet-balance';
import {
  GET_WALLET_HISTORY,
  type GetWalletHistoryPort,
} from '../../../application/port/in/get-wallet-history';
import {
  HANDLE_TOP_UP_CALLBACK,
  type HandleTopUpCallbackPort,
} from '../../../application/port/in/handle-top-up-callback';
import { toCallbackInput } from './sepay-ipn';
import { currentUserId, type RequestWithIdentity } from '../../../../../../shared/http/identity';
import {
  RawResponse,
  ResponseCode,
  ResponseMessage,
} from '../../../../../../shared/http/response-code.decorator';
import {
  SepayIpnDto,
  TopUpIntentDto,
  TopUpIntentStatusDto,
  TopUpRequestDto,
  WalletBalanceDto,
  WalletHistoryPageDto,
  WalletHistoryQueryDto,
} from './dto/wallet.dto';

@Controller('wallet')
@ApiTags('wallet')
@ApiBearerAuth('bearer')
export class WalletController {
  private readonly logger = new Logger(WalletController.name);

  constructor(
    @Inject(INITIATE_TOP_UP) private readonly initiateTopUp: InitiateTopUpPort,
    @Inject(GET_WALLET_BALANCE) private readonly getBalance: GetWalletBalancePort,
    @Inject(GET_WALLET_HISTORY) private readonly getHistory: GetWalletHistoryPort,
    @Inject(HANDLE_TOP_UP_CALLBACK) private readonly callback: HandleTopUpCallbackPort,
    @Inject(GET_TOP_UP_INTENT) private readonly getTopUpIntent: GetTopUpIntentPort,
  ) {}

  @Post('top-ups')
  @ApiOperation({ summary: 'Start a wallet top-up (FR-008 / API-006)' })
  @ApiOkResponse({ type: TopUpIntentDto, description: 'Pending top-up intent with a payment URL' })
  start(
    @Body() body: TopUpRequestDto,
    @Req() request: RequestWithIdentity,
  ): Promise<TopUpIntentCreated> {
    return this.initiateTopUp.execute({
      ownerId: currentUserId(request),
      amountVnd: body.amountVnd,
      // FR-008: the payer's own client decides where to come back to; the use
      // case accepts it only on our origin or the app scheme (422 otherwise).
      returnUrl: body.returnUrl,
    });
  }

  /**
   * FR-008 / ADR-033: poll one top-up intent.
   *
   * The SePay IPN settles the intent server-to-server and pushes nothing to the
   * browser, so the client needs a way to ask whether its payment landed. The
   * response has no `paymentUrl` (see `topUpIntentStatusSchema`). A missing id
   * and another owner's id are both 404 — no existence probe.
   */
  @Get('top-ups/:id')
  @ResponseCode('WALLET_TOP_UP_OK')
  @ResponseMessage('Top-up intent loaded')
  @ApiOperation({ summary: 'Poll a wallet top-up intent (FR-008 / ADR-033)' })
  @ApiOkResponse({ type: TopUpIntentStatusDto, description: 'The intent, including settlement facts' })
  topUpStatus(
    @Param('id') id: string,
    @Req() request: RequestWithIdentity,
  ): Promise<TopUpIntentStatusView> {
    return this.getTopUpIntent.execute(currentUserId(request), id);
  }

  /**
   * FR-008: the same read, keyed by the invoice number.
   *
   * The return page only ever receives `providerRef` (SePay's redirect carries
   * our URL plus the invoice number), so it needs this handle. Owner-scoped
   * identically: a foreign invoice number is 404.
   *
   * Declared before `top-ups/:id` would matter only for a conflicting path; the
   * literal segment `by-provider-ref` cannot be mistaken for a uuid, and the
   * lookup rejects anything that is not one anyway.
   */
  @Get('top-ups/by-provider-ref/:providerRef')
  @ResponseCode('WALLET_TOP_UP_OK')
  @ResponseMessage('Top-up intent loaded')
  @ApiOperation({ summary: 'Read a top-up intent by invoice number (FR-008)' })
  @ApiOkResponse({ type: TopUpIntentStatusDto, description: 'The intent, including settlement facts' })
  topUpStatusByProviderRef(
    @Param('providerRef') providerRef: string,
    @Req() request: RequestWithIdentity,
  ): Promise<TopUpIntentStatusView> {
    return this.getTopUpIntent.executeByProviderRef(currentUserId(request), providerRef);
  }

  /**
   * FR-008 / ADR-033: the SePay Payment Gateway IPN.
   *
   * SePay expects exactly `200 {"success": true}` and retries on anything else,
   * so every *recognised* notification is acknowledged even when it applies
   * nothing (unknown invoice, replay). Only a malformed body is rejected, since
   * retrying it would never help.
   *
   * Authentication is by IP allow-list at the edge plus the invoice lookup: the
   * IPN carries no secret header and SePay does not send a `User-Agent`, so
   * neither can be used as a check.
   */
  @Post('top-ups/callback')
  @HttpCode(HttpStatus.OK)
  @RawResponse()
  @ApiOperation({ summary: 'SePay Payment Gateway IPN (ADR-033)' })
  @ApiOkResponse({ description: 'SePay acknowledgement: { success: true }' })
  async onCallback(@Body() body: SepayIpnDto): Promise<SepayIpnAck> {
    const input = toCallbackInput(body);
    if (input === null) {
      this.logger.log(`Ignoring SePay notification type ${body.notification_type}`);
      return { success: true };
    }
    const result = await this.callback.execute(input);
    this.logger.log(
      `SePay IPN ${body.notification_type} for ${input.providerRef}: applied=${result.applied} status=${result.status}`,
    );
    return { success: true };
  }

  /**
   * The browser lands here after `success_url` / `error_url` / `cancel_url`.
   * It is a plain GET and must never credit anything; the IPN above does that.
   */
  @Get('top-ups/callback')
  @RawResponse()
  @ApiOperation({ summary: 'Browser return from the SePay hosted checkout (ADR-033)' })
  returnFromCheckout(): SepayIpnAck {
    return { success: true };
  }

  @Get('balance')
  @ResponseCode('WALLET_BALANCE_OK')
  @ResponseMessage('Wallet balance loaded')
  @ApiOperation({ summary: 'Read the wallet balance (FR-008/FR-010)' })
  @ApiOkResponse({ type: WalletBalanceDto, description: 'Available and pending credits' })
  balance(@Req() request: RequestWithIdentity): Promise<WalletBalanceView> {
    return this.getBalance.execute(currentUserId(request));
  }

  @Get('history')
  @ResponseCode('WALLET_HISTORY_OK')
  @ResponseMessage('Wallet history loaded')
  @ApiOperation({ summary: 'Read the wallet ledger history (FR-010 / ADR-022)' })
  @ApiOkResponse({ type: WalletHistoryPageDto, description: 'A page of owner-scoped ledger entries, newest first' })
  history(
    @Query() query: WalletHistoryQueryDto,
    @Req() request: RequestWithIdentity,
  ): Promise<WalletHistoryPage> {
    return this.getHistory.execute({
      ownerId: currentUserId(request),
      limit: query.limit,
      cursor: query.cursor,
    });
  }
}
