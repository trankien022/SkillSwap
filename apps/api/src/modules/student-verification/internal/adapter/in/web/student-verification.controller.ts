import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type {
  AdminVerificationPage,
  DocumentDownloadTargetView,
  DocumentUploadTargetView,
  StudentVerificationView,
} from '@skillswap/contracts';
import {
  SUBMIT_STUDENT_VERIFICATION,
  type SubmitStudentVerificationPort,
} from '../../../application/port/in/submit-student-verification';
import {
  REQUEST_DOCUMENT_UPLOAD,
  type RequestDocumentUploadPort,
} from '../../../application/port/in/request-document-upload';
import {
  DECIDE_STUDENT_VERIFICATION,
  type DecideStudentVerificationPort,
} from '../../../application/port/in/decide-student-verification';
import {
  REVOKE_STUDENT_VERIFICATION,
  type RevokeStudentVerificationPort,
} from '../../../application/port/in/revoke-student-verification';
import {
  GET_MY_VERIFICATION,
  type GetMyVerificationPort,
} from '../../../application/port/in/get-my-verification';
import {
  LIST_ADMIN_VERIFICATIONS,
  type ListAdminVerificationsPort,
} from '../../../application/port/in/list-admin-verifications';
import {
  READ_VERIFICATION_DOCUMENT,
  type ReadVerificationDocumentPort,
} from '../../../application/port/in/read-verification-document';
import { currentUserId, type RequestWithIdentity } from '../../../../../../shared/http/identity';
import { Roles } from '../../../../../../shared/http/roles.decorator';
import {
  ResponseCode,
  ResponseMessage,
} from '../../../../../../shared/http/response-code.decorator';
import {
  AdminVerificationPageDto,
  AdminVerificationQueryDto,
  DocumentDownloadTargetDto,
  DocumentUploadRequestDto,
  DocumentUploadTargetDto,
  StudentVerificationDto,
  SubmitStudentVerificationDto,
  VerificationDecisionDto,
  VerificationRevocationDto,
} from './dto/student-verification.dto';

@Controller('student-verifications')
@ApiTags('student-verification')
@ApiBearerAuth('bearer')
export class StudentVerificationController {
  constructor(
    @Inject(SUBMIT_STUDENT_VERIFICATION) private readonly submit: SubmitStudentVerificationPort,
    @Inject(REQUEST_DOCUMENT_UPLOAD) private readonly requestUpload: RequestDocumentUploadPort,
    @Inject(DECIDE_STUDENT_VERIFICATION) private readonly decide: DecideStudentVerificationPort,
    @Inject(REVOKE_STUDENT_VERIFICATION) private readonly revoke: RevokeStudentVerificationPort,
    @Inject(GET_MY_VERIFICATION) private readonly getMine: GetMyVerificationPort,
    @Inject(LIST_ADMIN_VERIFICATIONS) private readonly listAdmin: ListAdminVerificationsPort,
    @Inject(READ_VERIFICATION_DOCUMENT)
    private readonly readDocumentUseCase: ReadVerificationDocumentPort,
  ) {}

  @Post('documents')
  @ApiOperation({ summary: 'Request a signed document upload target (FR-002)' })
  @ApiOkResponse({ type: DocumentUploadTargetDto, description: 'Pre-signed PUT URL plus the document id to submit' })
  requestDocumentUpload(
    @Body() body: DocumentUploadRequestDto,
    @Req() request: RequestWithIdentity,
  ): Promise<DocumentUploadTargetView> {
    return this.requestUpload.execute({
      accountId: currentUserId(request),
      fileName: body.fileName,
      contentType: body.contentType,
      sizeBytes: body.sizeBytes,
    });
  }

  @Post()
  @ApiOperation({ summary: 'Submit a student verification (FR-002 / API-001)' })
  @ApiOkResponse({ type: StudentVerificationDto, description: 'The pending verification' })
  create(
    @Body() body: SubmitStudentVerificationDto,
    @Req() request: RequestWithIdentity,
  ): Promise<StudentVerificationView> {
    return this.submit.execute({
      accountId: currentUserId(request),
      schoolName: body.schoolName,
      major: body.major,
      documentId: body.documentId,
    });
  }

  @Post(':id/decision')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'The verification id' })
  @ApiOperation({ summary: 'Approve or reject a verification (admin, FR-002)' })
  @ApiOkResponse({ type: StudentVerificationDto, description: 'The decided verification' })
  decideVerification(
    @Param('id') id: string,
    @Req() request: RequestWithIdentity,
    @Body() body: VerificationDecisionDto,
  ): Promise<StudentVerificationView> {
    return this.decide.execute({
      verificationId: id,
      reviewerId: currentUserId(request),
      reviewerRole: request.user?.role,
      decision: body.decision,
      reason: body.reason,
      approvedMajor: body.approvedMajor,
    });
  }

  @Post(':id/revocation')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'The verification id' })
  @ApiOperation({ summary: 'Revoke a verification (admin, FR-019 / ADR-025)' })
  @ApiOkResponse({ type: StudentVerificationDto, description: 'The revoked verification' })
  revokeVerification(
    @Param('id') id: string,
    @Req() request: RequestWithIdentity,
    @Body() body: VerificationRevocationDto,
  ): Promise<StudentVerificationView> {
    return this.revoke.execute({
      verificationId: id,
      reviewerId: currentUserId(request),
      reviewerRole: request.user?.role,
      reason: body.reason,
    });
  }

  @Get('me')
  @ResponseCode('STUDENT_VERIFICATION_ME_OK')
  @ResponseMessage('Your verification loaded')
  @ApiOperation({ summary: "Read the caller's own verification (FR-017)" })
  @ApiOkResponse({ type: StudentVerificationDto, description: 'The latest verification for the caller, or null' })
  mine(@Req() request: RequestWithIdentity): Promise<StudentVerificationView | null> {
    return this.getMine.execute(currentUserId(request));
  }

  /**
   * ADR-023 Amendment A: mint a short-lived download URL for the document behind a verification.
   *
   * Declared **after** `@Get('me')` for the same reason the bare collector is (see below): Nest
   * matches routes in declaration order, and a parameterised `:id` route placed earlier would
   * swallow `GET /student-verifications/me` as `id = 'me'`. A separate route from the record itself
   * is deliberate — a URL must not ride along in a list payload where it would be cached, logged or
   * forwarded by accident.
   */
  @Get(':id/document')
  @Roles('admin', 'verifier')
  @ApiParam({ name: 'id', description: 'The verification id' })
  @ApiOperation({ summary: 'Mint a short-lived download URL for the uploaded document (FR-002)' })
  @ApiOkResponse({
    type: DocumentDownloadTargetDto,
    description: 'A signed, expiring download URL',
  })
  readDocument(
    @Param('id') id: string,
    @Req() request: RequestWithIdentity,
  ): Promise<DocumentDownloadTargetView> {
    return this.readDocumentUseCase.execute({
      verificationId: id,
      actorId: currentUserId(request),
      actorRole: request.user?.role,
    });
  }

  /**
   * FR-015: the Administrator's verification queue (NFR-014).
   *
   * Declared **after** `mine` on purpose: Nest matches routes in declaration order, and a bare
   * `@Get()` declared first would shadow `GET /student-verifications/me` and route the caller's
   * own read into the admin queue. `student-verification.controller.spec.ts` pins that `me`
   * still resolves to `mine`.
   */
  @Get()
  @Roles('admin')
  @ResponseCode('ADMIN_VERIFICATIONS_OK')
  @ResponseMessage('Verification queue loaded')
  @ApiOperation({ summary: 'The admin verification queue (FR-015)' })
  @ApiOkResponse({ type: AdminVerificationPageDto, description: 'A page of student verifications' })
  listVerifications(@Query() query: AdminVerificationQueryDto): Promise<AdminVerificationPage> {
    return this.listAdmin.execute(query);
  }
}
