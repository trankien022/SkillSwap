import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  topUpCallbackSchema,
  topUpRequestSchema,
  type TopUpCallbackInput,
  type TopUpIntentView,
  type TopUpRequestInput,
  type WalletBalanceView,
} from '@skillswap/contracts';
import {
  INITIATE_TOP_UP,
  type InitiateTopUpPort,
} from '../../../application/port/in/initiate-top-up';
import {
  GET_WALLET_BALANCE,
  type GetWalletBalancePort,
} from '../../../application/port/in/get-wallet-balance';
import {
  HANDLE_TOP_UP_CALLBACK,
  type HandleTopUpCallbackPort,
} from '../../../application/port/in/handle-top-up-callback';
import {
  WEBHOOK_SIGNATURE_VERIFIER,
  type WebhookSignatureVerifier,
} from '../../../application/port/out/webhook-signature-verifier';
import { currentUserId, type RequestWithIdentity } from '../../../../../../shared/http/identity';
import { ZodValidationPipe } from '../../../../../../shared/http/zod-validation.pipe';

/** Express request with the raw body captured by Nest (for HMAC verification). */
interface RequestWithRawBody extends RequestWithIdentity {
  rawBody?: Buffer;
}

@Controller('wallet')
@ApiTags('wallet')
export class WalletController {
  constructor(
    @Inject(INITIATE_TOP_UP) private readonly initiateTopUp: InitiateTopUpPort,
    @Inject(GET_WALLET_BALANCE) private readonly getBalance: GetWalletBalancePort,
    @Inject(HANDLE_TOP_UP_CALLBACK) private readonly callback: HandleTopUpCallbackPort,
    @Inject(WEBHOOK_SIGNATURE_VERIFIER) private readonly verifier: WebhookSignatureVerifier,
  ) {}

  @Post('top-ups')
  @ApiOperation({ summary: 'Start a wallet top-up (FR-008 / API-006)' })
  @ApiOkResponse({ description: 'Pending top-up intent with a payment URL' })
  start(
    @Body(new ZodValidationPipe(topUpRequestSchema)) body: TopUpRequestInput,
    @Req() request: RequestWithIdentity,
  ): Promise<TopUpIntentView> {
    return this.initiateTopUp.execute({ ownerId: currentUserId(request), amountVnd: body.amountVnd });
  }

  @Post('top-ups/callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Payment provider callback (signature verified)' })
  @ApiOkResponse({ description: 'Whether the callback was applied' })
  async onCallback(
    @Body(new ZodValidationPipe(topUpCallbackSchema)) body: TopUpCallbackInput,
    @Headers('x-signature') signature: string | undefined,
    @Req() request: RequestWithRawBody,
  ): Promise<{ applied: boolean; status: string }> {
    const rawBody = request.rawBody?.toString('utf8') ?? JSON.stringify(body);
    if (!this.verifier.verify(rawBody, signature ?? '')) {
      throw new UnauthorizedException('Invalid payment signature');
    }
    return this.callback.execute(body);
  }

  @Get('balance')
  @ApiOperation({ summary: 'Read the wallet balance (FR-008/FR-010)' })
  @ApiOkResponse({ description: 'Available and pending credits' })
  balance(@Req() request: RequestWithIdentity): Promise<WalletBalanceView> {
    return this.getBalance.execute(currentUserId(request));
  }
}
