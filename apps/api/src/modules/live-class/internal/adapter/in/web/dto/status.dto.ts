import { createZodDto } from 'nestjs-zod';
import {
  advanceStatusResultSchema,
  advanceStatusSchema,
  moduleStatusSchema,
} from '@skillswap/contracts';

/** Request body for POST /live-class/status/advance. */
export class AdvanceStatusDto extends createZodDto(advanceStatusSchema) {}

/** Current module status returned by the status endpoints. */
export class ModuleStatusDto extends createZodDto(moduleStatusSchema) {}

/** Applied status transition returned by the advance endpoint. */
export class AdvanceStatusResultDto extends createZodDto(advanceStatusResultSchema) {}
