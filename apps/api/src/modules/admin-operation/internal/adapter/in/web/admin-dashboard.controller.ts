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
 *
 * **Two paths, one handler.** ADR-034 §7 shipped `GET /admin-operation/dashboard`, and the W6 plan
 * names the same aggregate `GET /operations/dashboard` because the lock list lands beside it under
 * `operations/`. Rather than move the route and break clients that already call the shipped path,
 * the aggregate answers on both. Both routes are the same read, so they cannot disagree.
 */
@Controller(['admin-operation/dashboard', 'operations/dashboard'])
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
    description:
      'Verification and evidence counts, queue depth by domain, recent audit events, and suspended accounts',
  })
  read(): Promise<AdminDashboard> {
    return this.dashboard.execute();
  }
}
