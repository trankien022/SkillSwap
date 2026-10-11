import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ADVANCE_STATUS,
  type AdvanceStatusPort,
  type AdvanceStatusResult,
} from '../../../application/port/in/advance-status';
import {
  GET_MODULE_STATUS,
  type GetModuleStatusPort,
} from '../../../application/port/in/get-module-status';
import type { ModuleStatusView } from '../../../application/port/out/module-status-reader';
import { currentUserId, type RequestWithIdentity } from '../../../../../../shared/http/identity';
import {
  ResponseCode,
  ResponseMessage,
} from '../../../../../../shared/http/response-code.decorator';
import { AdvanceStatusDto, AdvanceStatusResultDto, ModuleStatusDto } from './dto/status.dto';

@Controller('student-verification')
@ApiTags('student-verification')
export class StatusController {
  constructor(
    @Inject(ADVANCE_STATUS) private readonly advanceStatus: AdvanceStatusPort,
    @Inject(GET_MODULE_STATUS) private readonly getStatus: GetModuleStatusPort,
  ) {}

  @Get('status')
  @ResponseCode('STUDENT_VERIFICATION_STATUS_OK')
  @ResponseMessage('Student verification module status loaded')
  @ApiOperation({ summary: 'Read Student verification module status' })
  @ApiOkResponse({ type: ModuleStatusDto, description: 'Current module status' })
  readStatus(): Promise<ModuleStatusView> {
    return this.getStatus.execute();
  }

  @Post('status/advance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Advance Student verification module status' })
  @ApiOkResponse({ type: AdvanceStatusResultDto, description: 'Applied status transition' })
  advance(
    @Body() body: AdvanceStatusDto,
    @Req() request: RequestWithIdentity,
  ): Promise<AdvanceStatusResult> {
    return this.advanceStatus.execute({
      toState: body.toState,
      changedBy: currentUserId(request),
    });
  }
}
