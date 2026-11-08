import { Body, Controller, Get, Inject, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type {
  DocumentDownloadTargetView,
  EvidenceDocumentUploadTargetView,
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
import {
  REQUEST_EVIDENCE_DOCUMENT_UPLOAD,
  type RequestEvidenceDocumentUploadPort,
} from '../../../application/port/in/request-evidence-document-upload';
import {
  READ_SKILL_EVIDENCE_DOCUMENT,
  type ReadSkillEvidenceDocumentPort,
} from '../../../application/port/in/read-skill-evidence-document';
import { Roles } from '../../../../../../shared/http/roles.decorator';
import { currentUserId, type RequestWithIdentity } from '../../../../../../shared/http/identity';
import {
  ResponseCode,
  ResponseMessage,
} from '../../../../../../shared/http/response-code.decorator';
import {
  ProfileSkillListDto,
  ProfileSkillQueryDto,
  EvidenceDocumentDownloadTargetDto,
  EvidenceDocumentUploadRequestDto,
  EvidenceDocumentUploadTargetDto,
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
    @Inject(REQUEST_EVIDENCE_DOCUMENT_UPLOAD)
    private readonly requestUpload: RequestEvidenceDocumentUploadPort,
    @Inject(READ_SKILL_EVIDENCE_DOCUMENT)
    private readonly readDocument: ReadSkillEvidenceDocumentPort,
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

  /**
   * FR-003: where a client puts a certificate.
   *
   * Declared **before** the bare `@Post()` collector would matter for a GET, but it is before
   * `@Get(':id/history')` for the same reason `@Get('me')` precedes `:id` elsewhere: a literal path
   * must be registered before a parameterised sibling or the parameterised one shadows it.
   */
  @Post('documents')
  @ApiOperation({
    summary: 'Request a pre-signed upload target for certificate evidence (FR-003)',
    description:
      'Same allow-list and size cap as a student-verification document upload. The returned ' +
      '`objectKey` is the reference to send as `documentRef` when submitting the evidence.',
  })
  @ApiOkResponse({
    type: EvidenceDocumentUploadTargetDto,
    description: 'A pre-signed PUT URL, its object key and expiry',
  })
  requestDocumentUpload(
    @Body() body: EvidenceDocumentUploadRequestDto,
    @Req() request: RequestWithIdentity,
  ): Promise<EvidenceDocumentUploadTargetView> {
    return this.requestUpload.execute({
      accountId: currentUserId(request),
      fileName: body.fileName,
      contentType: body.contentType,
      sizeBytes: body.sizeBytes,
    });
  }

  @Get(':id/history')
  @ResponseCode('SKILL_EVIDENCE_HISTORY_OK')
  @ResponseMessage('Skill evidence history loaded')
  @ApiParam({ name: 'id', description: 'The evidence id' })
  @ApiOperation({
    summary: 'Decision history for each evidence version (FR-018)',
    description:
      'Complete by design: returns every version of the profile-skill with its audit trail (bounded by the number of submissions), so it is not paginated.',
  })
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

  /**
   * FR-003: mint a short-lived pre-signed GET for the certificate behind one evidence version.
   *
   * A separate route from `:id/history` on purpose — the history is the record of the decision, a
   * URL is a credential. Mixing them would put a 300-second credential into a payload that clients
   * cache and that the history view is explicitly meant to be safely shareable.
   *
   * Declared after `:id/history`; both are parameterised and neither shadows the other because the
   * suffix differs, but `documents` above is declared first for the literal-before-parameter reason.
   */
  @Get(':id/document')
  @Roles('admin', 'verifier', 'user')
  @ApiParam({ name: 'id', description: 'The evidence id' })
  @ApiOperation({
    summary: 'Mint a pre-signed download URL for certificate evidence (FR-003)',
    description:
      'Readable by the owner, an Administrator, or any Verifier (ADR-023 Amendment A: the role is ' +
      'the permission, the claim is the work assignment). The URL lives 300 seconds and is a ' +
      'credential: it is returned here and never stored or listed.',
  })
  @ApiOkResponse({
    type: EvidenceDocumentDownloadTargetDto,
    description: 'A pre-signed GET URL and its expiry',
  })
  document(
    @Param('id') id: string,
    @Req() request: RequestWithIdentity,
  ): Promise<DocumentDownloadTargetView> {
    return this.readDocument.execute({
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
