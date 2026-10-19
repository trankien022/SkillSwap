import {
  BadRequestException,
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
import {
  classDetailViewSchema,
  type ClassDetailView,
} from '@skillswap/contracts';
import {
  ClassDetailNotFoundError,
  GET_CLASS_DETAIL,
  type GetClassDetailPort,
} from '../../../application/port/in/get-class-detail';
import { currentUserId, type RequestWithIdentity } from '../../../../../../shared/http/identity';
import {
  ResponseCode,
  ResponseMessage,
} from '../../../../../../shared/http/response-code.decorator';
import { ClassDetailViewDto } from './dto/class-read.dto';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Controller('classes')
@ApiTags('classes')
@ApiBearerAuth('bearer')
export class ClassDetailController {
  constructor(
    @Inject(GET_CLASS_DETAIL) private readonly getClassDetail: GetClassDetailPort,
  ) {}

  @Get(':id')
  @ResponseCode('CLASS_DETAIL_OK')
  @ResponseMessage('Class detail loaded')
  @ApiParam({ name: 'id', description: 'The class id' })
  @ApiOperation({
    summary: 'Get class detail (FR-005, FR-006, FR-007 / Route 14)',
    description:
      'One read for the whole detail screen, including the teacher summary, seats, own booking, recent ratings and the class skills resolved from the skill catalogue (`skills` is omitted when that catalogue read is unavailable).',
  })
  @ApiOkResponse({ type: ClassDetailViewDto, description: 'Class detail view including teacher summary, seats and own booking' })
  @ApiNotFoundResponse({ description: 'No class with that id is visible to the caller (HTTP_404)' })
  async getDetail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: RequestWithIdentity,
  ): Promise<ClassDetailView> {
    const userId = currentUserId(request);
    if (!userId || userId === 'anonymous') {
      throw new UnauthorizedException('Authentication required');
    }

    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('Invalid class UUID');
    }

    try {
      const detail = await this.getClassDetail.execute({
        classId: id,
        callerId: userId,
      });

      return classDetailViewSchema.parse(detail);
    } catch (error) {
      if (error instanceof ClassDetailNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}
