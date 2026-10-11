import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type {
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
import { currentUserId, type RequestWithIdentity } from '../../../../../../shared/http/identity';
import { Roles } from '../../../../../../shared/http/roles.decorator';
import {
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
  ) {}

  @Post('documents')
  @ApiOperation({ summary: 'Request a pre-signed document upload target (FR-002)' })
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
  @ApiOperation({ summary: "Read the caller's own verification (FR-017)" })
  @ApiOkResponse({ type: StudentVerificationDto, description: 'The latest verification for the caller, or null' })
  mine(@Req() request: RequestWithIdentity): Promise<StudentVerificationView | null> {
    return this.getMine.execute(currentUserId(request));
  }
}
