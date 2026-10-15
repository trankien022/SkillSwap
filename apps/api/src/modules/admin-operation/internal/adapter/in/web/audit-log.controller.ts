import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuditLogPage } from '@skillswap/contracts';
import {
  LIST_AUDIT_LOG,
  type ListAuditLogPort,
} from '../../../application/port/in/list-audit-log';
import { Roles } from '../../../../../../shared/http/roles.decorator';
import {
  ResponseCode,
  ResponseMessage,
} from '../../../../../../shared/http/response-code.decorator';
import { AuditLogPageDto, AuditLogQueryDto } from './dto/status.dto';

/**
 * FR-015 / ADR-034: the Admin audit log.
 *
 * A separate controller from `StatusController` because the two are different resources with
 * different audiences — the module-status endpoints describe the module's own lifecycle, while
 * this is the cross-cutting record of privileged actions. Both live under `admin-operation`, and
 * both are `admin`-only: an audit log is only useful if it is not readable by the people it
 * audits.
 */
@Controller('audit-log')
@ApiTags('admin-operation')
@ApiBearerAuth('bearer')
export class AuditLogController {
  constructor(@Inject(LIST_AUDIT_LOG) private readonly auditLog: ListAuditLogPort) {}

  @Get()
  @Roles('admin')
  @ResponseCode('AUDIT_LOG_OK')
  @ResponseMessage('Audit log loaded')
  @ApiOperation({ summary: 'The Admin audit log, filterable by actor, time and action (FR-015)' })
  @ApiOkResponse({
    type: AuditLogPageDto,
    description: 'A page of audited privileged actions, newest first',
  })
  list(@Query() query: AuditLogQueryDto): Promise<AuditLogPage> {
    return this.auditLog.execute(query);
  }
}
