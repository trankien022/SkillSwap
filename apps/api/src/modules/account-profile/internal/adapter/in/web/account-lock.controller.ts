import { Body, Controller, HttpCode, HttpStatus, Inject, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { suspendAccountSchema } from '@skillswap/contracts';
import {
  LOCK_ACCOUNT_PORT,
  type LockAccountPort,
  type LockAccountResult,
} from '../../../application/port/in/lock-account';
import { currentUserId, type RequestWithIdentity } from '../../../../../../shared/http/identity';
import { Roles } from '../../../../../../shared/http/roles.decorator';
import {
  ResponseCode,
  ResponseMessage,
} from '../../../../../../shared/http/response-code.decorator';

/** FR-015 / ADR-037: a suspension requires a reason; the schema trims and rejects blanks. */
export class SuspendAccountDto extends createZodDto(suspendAccountSchema) {}

/**
 * FR-015 / OQ-015 / ADR-037: an Administrator locks or unlocks an account.
 *
 * **API-only by decision (C5).** The SRS says the lock list has no web screen in the MVP; this is
 * the action behind it, and it is reachable by an Administrator with an API client.
 *
 * **Nothing here is automatic** (ADR-037 decision 3, C-010). There is no threshold, no sweep, and
 * no event that suspends anyone — a named Administrator acts, states why, and is recorded.
 *
 * Two routes rather than one route with a status field: `suspend` requires a reason and
 * `reinstate` must not carry one, so making them separate makes the difference impossible to get
 * wrong at the call site.
 */
@Controller('operations/accounts')
@ApiTags('admin-operation')
@ApiBearerAuth('bearer')
export class AccountLockController {
  constructor(@Inject(LOCK_ACCOUNT_PORT) private readonly lock: LockAccountPort) {}

  @Post(':accountId/suspension')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ResponseCode('ACCOUNT_SUSPENDED_OK')
  @ResponseMessage('Account suspended')
  @ApiParam({ name: 'accountId', description: 'The account id to suspend' })
  @ApiOperation({ summary: 'Suspend an account with a required reason (admin, FR-015)' })
  @ApiOkResponse({ description: 'The account is suspended and the act is audited' })
  async suspend(
    @Param('accountId') accountId: string,
    @Body() body: SuspendAccountDto,
    @Req() request: RequestWithIdentity,
  ): Promise<LockAccountResult> {
    return this.lock.execute({
      accountId,
      status: 'suspended',
      reason: body.reason,
      // ADR-035 / ADR-037: the caller is the Administrator acting; the path parameter is the
      // subject. Attributing the lock to the suspended account would make the audit log lie.
      actorId: currentUserId(request),
    });
  }

  @Post(':accountId/reinstatement')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ResponseCode('ACCOUNT_REINSTATED_OK')
  @ResponseMessage('Account reinstated')
  @ApiParam({ name: 'accountId', description: 'The account id to reactivate' })
  @ApiOperation({ summary: 'Reactivate a suspended account (admin, FR-015)' })
  @ApiOkResponse({ description: 'The account is active again and the act is audited' })
  async reinstate(
    @Param('accountId') accountId: string,
    @Req() request: RequestWithIdentity,
  ): Promise<LockAccountResult> {
    // No body: a reason describes a suspension, and ADR-037 decision 2 rejects one here rather
    // than dropping it.
    return this.lock.execute({
      accountId,
      status: 'active',
      reason: null,
      actorId: currentUserId(request),
    });
  }
}
