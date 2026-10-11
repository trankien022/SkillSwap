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
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Controller('classes')
@ApiTags('classes')
export class ClassDetailController {
  constructor(
    @Inject(GET_CLASS_DETAIL) private readonly getClassDetail: GetClassDetailPort,
  ) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get class detail (FR-005, FR-006, FR-007 / Route 14)' })
  @ApiOkResponse({ description: 'Class detail view including teacher summary, seats and own booking' })
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
