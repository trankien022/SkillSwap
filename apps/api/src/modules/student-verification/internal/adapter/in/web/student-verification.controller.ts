import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  documentUploadRequestSchema,
  submitStudentVerificationSchema,
  verificationDecisionSchema,
  type DocumentUploadRequestInput,
  type DocumentUploadTargetView,
  type StudentVerificationView,
  type SubmitStudentVerificationInput,
  type VerificationDecisionInput,
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
  GET_MY_VERIFICATION,
  type GetMyVerificationPort,
} from '../../../application/port/in/get-my-verification';
import { currentUserId, type RequestWithIdentity } from '../../../../../../shared/http/identity';
import { Roles } from '../../../../../../shared/http/roles.decorator';
import { ZodValidationPipe } from '../../../../../../shared/http/zod-validation.pipe';

@Controller('student-verifications')
@ApiTags('student-verification')
export class StudentVerificationController {
  constructor(
    @Inject(SUBMIT_STUDENT_VERIFICATION) private readonly submit: SubmitStudentVerificationPort,
    @Inject(REQUEST_DOCUMENT_UPLOAD) private readonly requestUpload: RequestDocumentUploadPort,
    @Inject(DECIDE_STUDENT_VERIFICATION) private readonly decide: DecideStudentVerificationPort,
    @Inject(GET_MY_VERIFICATION) private readonly getMine: GetMyVerificationPort,
  ) {}

  @Post('documents')
  @ApiOperation({ summary: 'Request a pre-signed document upload target (FR-002)' })
  @ApiOkResponse({ description: 'Pre-signed PUT URL plus the document id to submit' })
  requestDocumentUpload(
    @Body(new ZodValidationPipe(documentUploadRequestSchema)) body: DocumentUploadRequestInput,
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
  @ApiOkResponse({ description: 'The pending verification' })
  create(
    @Body(new ZodValidationPipe(submitStudentVerificationSchema)) body: SubmitStudentVerificationInput,
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
  @ApiOperation({ summary: 'Approve or reject a verification (admin, FR-002)' })
  @ApiOkResponse({ description: 'The decided verification' })
  decideVerification(
    @Param('id') id: string,
    @Req() request: RequestWithIdentity,
    @Body(new ZodValidationPipe(verificationDecisionSchema)) body: VerificationDecisionInput,
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

  @Get('me')
  @ApiOperation({ summary: "Read the caller's own verification (FR-017)" })
  @ApiOkResponse({ description: 'The latest verification for the caller, or null' })
  mine(@Req() request: RequestWithIdentity): Promise<StudentVerificationView | null> {
    return this.getMine.execute(currentUserId(request));
  }
}
