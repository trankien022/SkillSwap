import { Controller, Get, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AdminDashboard } from '@skillswap/contracts';
import {
  GET_ADMIN_DASHBOARD,
  type GetAdminDashboardPort,
} from '../../../application/port/in/get-admin-dashboard';
import { Roles } from '../../../../../../shared/http/roles.decorator';
import {
  ResponseCode,
  ResponseMessage,
} from '../../../../../../shared/http/response-code.decorator';
import { AdminDashboardDto } from './dto/admin-operation.dto';

/**
 * FR-015 / ADR-034 §7: the Administrator's operations dashboard.
 *
 * The counts-only landing aggregate. Every figure is a count of rows another module owns, read
 * through that module's published reader, so the screen and the queue behind it cannot disagree.
 *
 * `admin`-only, like the audit log: this is the operational picture of the whole platform.
 */
@Controller('admin-operation/dashboard')
@ApiTags('admin-operation')
@ApiBearerAuth('bearer')
export class AdminDashboardController {
  constructor(@Inject(GET_ADMIN_DASHBOARD) private readonly dashboard: GetAdminDashboardPort) {}

  @Get()
  @Roles('admin')
  @ResponseCode('ADMIN_DASHBOARD_OK')
  @ResponseMessage('Dashboard loaded')
  @ApiOperation({ summary: 'The operations dashboard aggregate (FR-015)' })
  @ApiOkResponse({
    type: AdminDashboardDto,
    description: 'Verification and evidence counts, queue depth by domain, and recent audit events',
  })
  read(): Promise<AdminDashboard> {
    return this.dashboard.execute();
  }
}
