import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { advanceStatusSchema } from '@skillswap/contracts';
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
import { ZodValidationPipe } from '../../../../../../shared/http/zod-validation.pipe';

@Controller('skill-verification')
@ApiTags('skill-verification')
export class StatusController {
  constructor(
    @Inject(ADVANCE_STATUS) private readonly advanceStatus: AdvanceStatusPort,
    @Inject(GET_MODULE_STATUS) private readonly getStatus: GetModuleStatusPort,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Read Skill verification module status' })
  @ApiOkResponse({ description: 'Current module status' })
  readStatus(): Promise<ModuleStatusView> {
    return this.getStatus.execute();
  }

  @Post('status/advance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Advance Skill verification module status' })
  @ApiOkResponse({ description: 'Applied status transition' })
  advance(
    @Body(new ZodValidationPipe(advanceStatusSchema)) body: { toState: string },
    @Req() request: RequestWithIdentity,
  ): Promise<AdvanceStatusResult> {
    return this.advanceStatus.execute({
      toState: body.toState,
      changedBy: currentUserId(request),
    });
  }
}
