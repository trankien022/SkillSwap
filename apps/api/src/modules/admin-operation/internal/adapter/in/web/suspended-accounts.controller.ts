import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SuspendedAccountsPage } from '@skillswap/contracts';
import { decodeCursor, encodeCursor } from '../../../../../../shared/http/keyset-cursor';
import {
  LIST_SUSPENDED_ACCOUNTS,
  type ListSuspendedAccountsPort,
} from '../../../application/port/in/list-suspended-accounts';
import { Roles } from '../../../../../../shared/http/roles.decorator';
import {
  ResponseCode,
  ResponseMessage,
} from '../../../../../../shared/http/response-code.decorator';
import { SuspendedAccountsPageDto, SuspendedAccountsQueryDto } from './dto/admin-operation.dto';

/**
 * FR-015 / OQ-015 / ADR-037: the account-lock list.
 *
 * `admin`-only (AC-033): a suspension list is a record of administrative action against named
 * people, so it is readable only by those who take such action.
 *
 * **API-only by decision (C5).** There is no web screen for this list in the MVP; the SRS says so.
 * A screen can be added later without reopening the gate, because the contract is already here.
 *
 * The cursor is opaque to callers: `decodeCursor`/`encodeCursor` (NFR-014) live here because the
 * application layer may not import `shared/http` (ADR-009, enforced by dependency-cruiser).
 */
@Controller('operations/accounts')
@ApiTags('admin-operation')
@ApiBearerAuth('bearer')
export class SuspendedAccountsController {
  constructor(
    @Inject(LIST_SUSPENDED_ACCOUNTS) private readonly accounts: ListSuspendedAccountsPort,
  ) {}

  @Get()
  @Roles('admin')
  @ResponseCode('SUSPENDED_ACCOUNTS_OK')
  @ResponseMessage('Suspended accounts loaded')
  @ApiOperation({ summary: 'The account-lock list: suspended accounts (FR-015)' })
  @ApiOkResponse({
    type: SuspendedAccountsPageDto,
    description: 'A page of suspended accounts with the reason and the Administrator who acted',
  })
  async list(@Query() query: SuspendedAccountsQueryDto): Promise<SuspendedAccountsPage> {
    // ADR-009: cursor base64 lives here, in the transport, and nowhere deeper. `decodeCursor`
    // answers `null` for a malformed cursor, which the handler reads as "first page".
    const page = await this.accounts.execute({
      limit: query.limit,
      status: query.status,
      cursor: decodeCursor(query.cursor) ?? undefined,
    });
    return {
      items: page.items,
      page: {
        ...page.page,
        nextCursor: page.page.nextCursor === null ? null : encodeCursor(page.page.nextCursor),
      },
    };
  }
}
