import { Body, Controller, Get, Inject, Post, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  submitSkillEvidenceSchema,
  type ProfileSkillView,
  type SkillEvidenceView,
  type SubmitSkillEvidenceInput,
} from '@skillswap/contracts';
import {
  SUBMIT_SKILL_EVIDENCE,
  type SubmitSkillEvidencePort,
} from '../../../application/port/in/submit-skill-evidence';
import {
  GET_MY_PROFILE_SKILLS,
  type GetMyProfileSkillsPort,
} from '../../../application/port/in/get-my-profile-skills';
import { currentUserId, type RequestWithIdentity } from '../../../../../../shared/http/identity';
import { ZodValidationPipe } from '../../../../../../shared/http/zod-validation.pipe';

@Controller('skill-evidence')
@ApiTags('skill-verification')
export class SkillEvidenceController {
  constructor(
    @Inject(SUBMIT_SKILL_EVIDENCE) private readonly submit: SubmitSkillEvidencePort,
    @Inject(GET_MY_PROFILE_SKILLS) private readonly getMine: GetMyProfileSkillsPort,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Submit skill evidence for a known skill (FR-003 / API-002)' })
  @ApiOkResponse({ description: 'The new pending evidence version' })
  create(
    @Body(new ZodValidationPipe(submitSkillEvidenceSchema)) body: SubmitSkillEvidenceInput,
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
}

@Controller('profile-skills')
@ApiTags('skill-verification')
export class ProfileSkillController {
  constructor(
    @Inject(GET_MY_PROFILE_SKILLS) private readonly getMine: GetMyProfileSkillsPort,
  ) {}

  @Get('me')
  @ApiOperation({ summary: "List the caller's skills and approved levels (FR-003)" })
  @ApiOkResponse({ description: 'The caller\'s profile skills with effective levels' })
  mine(@Req() request: RequestWithIdentity): Promise<ProfileSkillView[]> {
    return this.getMine.execute(currentUserId(request));
  }
}
