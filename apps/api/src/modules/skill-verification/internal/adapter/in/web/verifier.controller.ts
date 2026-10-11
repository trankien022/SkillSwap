import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { SkillEvidenceView, VerifierView } from '@skillswap/contracts';
import {
  CHANGE_VERIFIER_STATUS,
  type ChangeVerifierStatusPort,
} from '../../../application/port/in/change-verifier-status';
import {
  LIST_VERIFIER_QUEUE,
  type ListVerifierQueuePort,
} from '../../../application/port/in/list-verifier-queue';
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
  SkillEvidenceDecisionDto,
  SkillEvidenceDto,
  VerifierDto,
  VerifierStatusChangeDto,
} from './dto/skill-verification.dto';

@Controller('verifiers')
@ApiTags('skill-verification')
@ApiBearerAuth('bearer')
export class VerifierController {
  constructor(
    @Inject(CHANGE_VERIFIER_STATUS) private readonly changeStatus: ChangeVerifierStatusPort,
    @Inject(LIST_VERIFIER_QUEUE) private readonly queue: ListVerifierQueuePort,
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
  @ApiOperation({ summary: "The Verifier's expertise-scoped pending queue (FR-004)" })
  @ApiOkResponse({ type: SkillEvidenceDto, isArray: true, description: 'Pending evidence requests matching the caller’s expertise' })
  myQueue(@Req() request: RequestWithIdentity): Promise<SkillEvidenceView[]> {
    return this.queue.execute(currentUserId(request));
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
