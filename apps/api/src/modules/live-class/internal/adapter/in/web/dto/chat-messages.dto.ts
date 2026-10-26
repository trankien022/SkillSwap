import { createZodDto } from 'nestjs-zod';
import { chatMessagesPageSchema, chatMessageSchema } from '@skillswap/contracts';

/** FR-012: one stored chat message. */
export class ChatMessageDto extends createZodDto(chatMessageSchema) {}

/** FR-012 / NFR-014: a page of a booking's chat. */
export class ChatMessagesPageDto extends createZodDto(chatMessagesPageSchema) {}
