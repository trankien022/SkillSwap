import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type {
  AdminVerifierQueuePage,
  SkillEvidenceView,
  VerifierQueuePage,
  VerifierView,
} from '@skillswap/contracts';
import {
  CHANGE_VERIFIER_STATUS,
  type ChangeVerifierStatusPort,
} from '../../../application/port/in/change-verifier-status';
import {
  LIST_VERIFIER_QUEUE,
  type ListVerifierQueuePort,
} from '../../../application/port/in/list-verifier-queue';
import {
  LIST_ADMIN_VERIFIER_QUEUE,
  type ListAdminVerifierQueuePort,
} from '../../../application/port/in/list-admin-verifier-queue';
import {
  CLAIM_SKILL_EVIDENCE,
  type ClaimSkillEvidencePort,
} from '../../../application/port/in/claim-skill-evidence';
import {
  DECIDE_SKILL_EVIDENCE,
  type DecideSkillEvidencePort,
} from '../../../application/port/in/decide-skill-evidence';
import { currentUserId, type RequestWithIdentity } from '../../../../../../shared/http/identity';
import { Roles } from '../../../../../../shared/http/roles.decorator';
import {
  ResponseCode,
  ResponseMessage,
} from '../../../../../../shared/http/response-code.decorator';
import {
  AdminVerifierQueuePageDto,
  AdminVerifierQueueQueryDto,
  SkillEvidenceDecisionDto,
  SkillEvidenceDto,
  VerifierDto,
  VerifierQueuePageDto,
  VerifierQueueQueryDto,
  VerifierStatusChangeDto,
} from './dto/skill-verification.dto';

@Controller('verifiers')
@ApiTags('skill-verification')
@ApiBearerAuth('bearer')
export class VerifierController {
  constructor(
    @Inject(CHANGE_VERIFIER_STATUS) private readonly changeStatus: ChangeVerifierStatusPort,
    @Inject(LIST_VERIFIER_QUEUE) private readonly queue: ListVerifierQueuePort,
    @Inject(LIST_ADMIN_VERIFIER_QUEUE) private readonly adminQueue: ListAdminVerifierQueuePort,
  ) {}

  @Post(':accountId/status')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'accountId', description: 'The verifier account id' })
  @ApiOperation({ summary: 'Suspend, revoke or reactivate a Verifier (admin, FR-004 / ADR-027)' })
  @ApiOkResponse({ type: VerifierDto, description: 'The updated verifier' })
  setStatus(
    @Param('accountId') accountId: string,
    @Body() body: VerifierStatusChangeDto,
  ): Promise<VerifierView> {
    return this.changeStatus.execute({ verifierId: accountId, status: body.status });
  }

  @Get('me/queue')
  @Roles('verifier')
  @ResponseCode('VERIFIER_QUEUE_OK')
  @ResponseMessage('Verifier queue loaded')
  @ApiOperation({ summary: "The Verifier's expertise-scoped pending queue (FR-004 / NFR-014)" })
  @ApiOkResponse({
    type: VerifierQueuePageDto,
    description: 'A page of pending evidence requests matching the caller’s expertise',
  })
  myQueue(
    @Query() query: VerifierQueueQueryDto,
    @Req() request: RequestWithIdentity,
  ): Promise<VerifierQueuePage> {
    return this.queue.execute({
      verifierId: currentUserId(request),
      limit: query.limit,
      cursor: query.cursor,
      level: query.level,
      type: query.type,
      q: query.q,
      sort: query.sort,
    });
  }

  /**
   * FR-015: the cross-domain Verifier queue for an Administrator (NFR-014).
   *
   * Declared **after** `myQueue` for the same reason the student-verification controller declares
   * its admin route last: Nest matches in declaration order, and `me/queue` must win for a
   * Verifier calling it. The path is `admin/queue` rather than a bare `queue` so the two can
   * never be confused even if the order changes.
   */
  @Get('admin/queue')
  @Roles('admin')
  @ResponseCode('ADMIN_VERIFIER_QUEUE_OK')
  @ResponseMessage('Verifier queue loaded')
  @ApiOperation({ summary: 'The cross-domain Verifier queue by domain (FR-015)' })
  @ApiOkResponse({
    type: AdminVerifierQueuePageDto,
    description: 'A page of evidence requests across every domain, unclaimed or in review',
  })
  listAdminQueue(@Query() query: AdminVerifierQueueQueryDto): Promise<AdminVerifierQueuePage> {
    return this.adminQueue.execute(query);
  }
}

@Controller('skill-evidence')
@ApiTags('skill-verification')
@ApiBearerAuth('bearer')
export class SkillEvidenceDecisionController {
  constructor(
    @Inject(CLAIM_SKILL_EVIDENCE) private readonly claim: ClaimSkillEvidencePort,
    @Inject(DECIDE_SKILL_EVIDENCE) private readonly decide: DecideSkillEvidencePort,
  ) {}

  @Post(':id/claim')
  @Roles('verifier')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'The evidence id' })
  @ApiOperation({ summary: 'Claim a pending evidence request, locking it (FR-004 / BR-071)' })
  @ApiOkResponse({ type: SkillEvidenceDto, description: 'The now-claimed evidence' })
  claimEvidence(
    @Param('id') id: string,
    @Req() request: RequestWithIdentity,
  ): Promise<SkillEvidenceView> {
    return this.claim.execute({ verifierId: currentUserId(request), evidenceId: id });
  }

  @Post(':id/decision')
  @Roles('verifier')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'The evidence id' })
  @ApiOperation({ summary: 'Approve or reject a claimed evidence request (FR-004 / API-003)' })
  @ApiOkResponse({ type: SkillEvidenceDto, description: 'The decided evidence' })
  decideEvidence(
    @Param('id') id: string,
    @Req() request: RequestWithIdentity,
    @Body() body: SkillEvidenceDecisionDto,
  ): Promise<SkillEvidenceView> {
    return this.decide.execute({
      reviewerId: currentUserId(request),
      evidenceId: id,
      decision: body.decision,
      approvedLevel: body.approvedLevel,
      reason: body.reason,
    });
  }
}
