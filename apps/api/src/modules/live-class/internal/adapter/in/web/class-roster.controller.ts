import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { classRosterSchema, type ClassRosterView } from '@skillswap/contracts';
import {
  GET_CLASS_ROSTER,
  type GetClassRosterPort,
} from '../../../application/port/in/get-class-roster';
import { ClassRosterNotFoundError } from '../../../application/query/get-class-roster.query';
import { currentUserId, type RequestWithIdentity } from '../../../../../../shared/http/identity';
import {
  ResponseCode,
  ResponseMessage,
} from '../../../../../../shared/http/response-code.decorator';
import { ClassRosterDto } from './dto/class-read.dto';

/**
 * FR-011 / ADR-040: the teacher's roster for a class they hold.
 *
 * Deliberately separate from `GET /classes/:id`: that read is written for the marketplace and
 * a learner's own seat, and widening it would put other learners' identities on a route the
 * whole marketplace calls.
 */
@Controller('classes')
@ApiTags('classes')
@ApiBearerAuth('bearer')
export class ClassRosterController {
  constructor(@Inject(GET_CLASS_ROSTER) private readonly getClassRoster: GetClassRosterPort) {}

  @Get(':id/roster')
  @ResponseCode('CLASS_ROSTER_OK')
  @ResponseMessage('Class roster loaded')
  @ApiParam({ name: 'id', description: 'The class id' })
  @ApiOperation({
    summary: 'Get the teacher roster for a class (FR-011 / ADR-040)',
    description:
      'Teacher-only. Returns every active seat (confirmed, plus pending while the hold is unexpired) with the learner display name resolved through the account-profile facade. A caller who is not the class teacher receives 404, not 403, so the route does not confirm that an unowned class exists.',
  })
  @ApiOkResponse({ type: ClassRosterDto, description: 'Active seats for the class' })
  @ApiNotFoundResponse({ description: 'No class with that id, or the caller is not its teacher' })
  async getRoster(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: RequestWithIdentity,
  ): Promise<ClassRosterView> {
    const userId = currentUserId(request);
    if (!userId || userId === 'anonymous') {
      throw new UnauthorizedException('Authentication required');
    }

    try {
      const roster = await this.getClassRoster.execute({ classId: id, callerId: userId });
      return classRosterSchema.parse(roster);
    } catch (error) {
      if (error instanceof ClassRosterNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}
