import { Body, Controller, Get, Inject, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type {
  ProfileSkillList,
  SkillEvidenceHistoryView,
  SkillEvidenceView,
} from '@skillswap/contracts';
import {
  SUBMIT_SKILL_EVIDENCE,
  type SubmitSkillEvidencePort,
} from '../../../application/port/in/submit-skill-evidence';
import {
  GET_MY_PROFILE_SKILLS,
  type GetMyProfileSkillsPort,
} from '../../../application/port/in/get-my-profile-skills';
import {
  GET_SKILL_EVIDENCE_HISTORY,
  type GetSkillEvidenceHistoryPort,
} from '../../../application/port/in/get-skill-evidence-history';
import { currentUserId, type RequestWithIdentity } from '../../../../../../shared/http/identity';
import {
  ResponseCode,
  ResponseMessage,
} from '../../../../../../shared/http/response-code.decorator';
import {
  ProfileSkillListDto,
  ProfileSkillQueryDto,
  SkillEvidenceDto,
  SkillEvidenceHistoryDto,
  SubmitSkillEvidenceDto,
} from './dto/skill-verification.dto';

@Controller('skill-evidence')
@ApiTags('skill-verification')
@ApiBearerAuth('bearer')
export class SkillEvidenceController {
  constructor(
    @Inject(SUBMIT_SKILL_EVIDENCE) private readonly submit: SubmitSkillEvidencePort,
    @Inject(GET_MY_PROFILE_SKILLS) private readonly getMine: GetMyProfileSkillsPort,
    @Inject(GET_SKILL_EVIDENCE_HISTORY) private readonly getHistory: GetSkillEvidenceHistoryPort,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Submit skill evidence for a known skill (FR-003 / API-002)' })
  @ApiOkResponse({ type: SkillEvidenceDto, description: 'The new pending evidence version' })
  create(
    @Body() body: SubmitSkillEvidenceDto,
    @Req() request: RequestWithIdentity,
  ): Promise<SkillEvidenceView> {
    return this.submit.execute({
      accountId: currentUserId(request),
      skillId: body.skillId,
      requestedLevel: body.requestedLevel,
      evidenceType: body.evidenceType,
      documentRef: body.documentRef,
      description: body.description,
    });
  }

  @Get(':id/history')
  @ApiParam({ name: 'id', description: 'The evidence id' })
  @ApiOperation({ summary: 'Decision history for each evidence version (FR-018)' })
  @ApiOkResponse({ type: SkillEvidenceHistoryDto, description: 'All versions of the profile-skill with their audit trail' })
  history(
    @Param('id') id: string,
    @Req() request: RequestWithIdentity,
  ): Promise<SkillEvidenceHistoryView> {
    return this.getHistory.execute({
      evidenceId: id,
      viewerId: currentUserId(request),
      viewerRole: request.user?.role,
    });
  }
}

@Controller('profile-skills')
@ApiTags('skill-verification')
@ApiBearerAuth('bearer')
export class ProfileSkillController {
  constructor(
    @Inject(GET_MY_PROFILE_SKILLS) private readonly getMine: GetMyProfileSkillsPort,
  ) {}

  @Get('me')
  @ResponseCode('PROFILE_SKILLS_OK')
  @ResponseMessage('Profile skills loaded')
  @ApiOperation({
    summary: "List the caller's skills and approved levels (FR-003 / NFR-014)",
    description:
      'Bounded by the managed skill catalogue (at most one row per catalogue skill), so it is not paginated and returns `page: null`. Supports a skill-name search (`q`) and a sort order.',
  })
  @ApiOkResponse({ type: ProfileSkillListDto, description: "The caller's profile skills with effective levels" })
  mine(
    @Query() query: ProfileSkillQueryDto,
    @Req() request: RequestWithIdentity,
  ): Promise<ProfileSkillList> {
    return this.getMine.execute({
      accountId: currentUserId(request),
      q: query.q,
      sort: query.sort,
    });
  }
}
