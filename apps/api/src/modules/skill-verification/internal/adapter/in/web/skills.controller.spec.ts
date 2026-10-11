import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import {
  decodeSkillCursor,
  encodeSkillCursor,
  listSkillsQuerySchema,
} from '@skillswap/contracts';
import { ZodValidationPipe } from '../../../../../../shared/http/zod-validation.pipe';
import type { RequestWithIdentity } from '../../../../../../shared/http/identity';
import type { ListSkillsPort, SkillCataloguePageDto } from '../../../application/port/in/list-skills';
import { SkillsController } from './skills.controller';

describe('SkillsController', () => {
  let controller: SkillsController;
  let mockListSkillsPort: jest.Mocked<ListSkillsPort>;

  const samplePage: SkillCataloguePageDto = {
    items: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'TypeScript Programming',
        category: 'Technology',
        levels: ['beginner', 'intermediate', 'advanced', 'expert'],
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Graphic Design',
        category: 'Design',
        levels: ['beginner', 'intermediate', 'advanced', 'expert'],
      },
    ],
    nextCursor: ['Technology', 'TypeScript Programming', '11111111-1111-4111-8111-111111111111'],
  };

  beforeEach(() => {
    mockListSkillsPort = {
      execute: jest.fn().mockResolvedValue(samplePage),
    };
    controller = new SkillsController(mockListSkillsPort);
  });

  describe('Authentication enforcement', () => {
    it('rejects unauthenticated request when user is missing', async () => {
      const unauthRequest: RequestWithIdentity = {
        headers: {},
        user: undefined,
      };

      await expect(controller.list({ limit: 50 }, unauthRequest)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockListSkillsPort.execute).not.toHaveBeenCalled();
    });

    it('rejects request when user identity is anonymous', async () => {
      const anonRequest: RequestWithIdentity = {
        headers: {},
        user: { id: 'anonymous' },
      };

      await expect(controller.list({ limit: 50 }, anonRequest)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockListSkillsPort.execute).not.toHaveBeenCalled();
    });

    it('rejects request when user id is empty string', async () => {
      const emptyUserRequest: RequestWithIdentity = {
        headers: {},
        user: { id: '' },
      };

      await expect(controller.list({ limit: 50 }, emptyUserRequest)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockListSkillsPort.execute).not.toHaveBeenCalled();
    });
  });

  describe('Authenticated request and cursor translation', () => {
    const authRequest: RequestWithIdentity = {
      headers: { 'x-user-id': 'usr-test-123' },
      user: { id: 'usr-test-123', role: 'student' },
    };

    it('decodes incoming base64url cursor, calls port, and encodes outgoing nextCursor', async () => {
      const incomingCursor = encodeSkillCursor(['Technology', 'Java', 'sk-0']);
      const query = { category: 'Technology', keyword: 'Type', limit: 10, cursor: incomingCursor };

      const result = await controller.list(query, authRequest);

      expect(mockListSkillsPort.execute).toHaveBeenCalledWith({
        category: 'Technology',
        keyword: 'Type',
        limit: 10,
        cursor: ['Technology', 'Java', 'sk-0'],
      });

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual({
        id: '11111111-1111-4111-8111-111111111111',
        name: 'TypeScript Programming',
        category: 'Technology',
        levels: ['beginner', 'intermediate', 'advanced', 'expert'],
      });
      expect(result.nextCursor).toBe(
        encodeSkillCursor(['Technology', 'TypeScript Programming', '11111111-1111-4111-8111-111111111111']),
      );
    });

    it('preserves delimiters and unicode through cursor decode and port execution', async () => {
      const unicodeCursor = encodeSkillCursor([
        'Web | Cloud & DevOps',
        'Lập trình C++ | C#',
        'sk-uni-1',
      ]);
      const query = { limit: 50, cursor: unicodeCursor };

      await controller.list(query, authRequest);

      expect(mockListSkillsPort.execute).toHaveBeenCalledWith({
        category: undefined,
        keyword: undefined,
        limit: 50,
        cursor: ['Web | Cloud & DevOps', 'Lập trình C++ | C#', 'sk-uni-1'],
      });
    });

    it('rejects malformed cursor with 400 BadRequestException', async () => {
      await expect(controller.list({ limit: 50, cursor: 'malformed_non_base64_json' }, authRequest)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects pipe-delimited cursor with 400 BadRequestException', async () => {
      await expect(controller.list({ limit: 50, cursor: 'Tech|Node|sk-1' }, authRequest)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('Query pipe validation', () => {
    const pipe = new ZodValidationPipe(listSkillsQuerySchema);

    it('coerces and defaults valid query with keyword', () => {
      const parsed = pipe.transform({ limit: '25', keyword: 'React' });
      expect(parsed).toEqual({
        limit: 25,
        keyword: 'React',
      });
    });

    it('rejects limit exceeding maximum 100 or below 1', () => {
      expect(() => pipe.transform({ limit: '150' })).toThrow(BadRequestException);
      expect(() => pipe.transform({ limit: '0' })).toThrow(BadRequestException);
      expect(() => pipe.transform({ limit: '-10' })).toThrow(BadRequestException);
    });

    it('rejects empty category string or empty keyword string', () => {
      expect(() => pipe.transform({ category: '' })).toThrow(BadRequestException);
      expect(() => pipe.transform({ keyword: '' })).toThrow(BadRequestException);
    });

    it('accepts valid base64url cursor in pipe validation', () => {
      const validCursor = encodeSkillCursor(['Design', 'Figma', 'sk-figma']);
      const parsed = pipe.transform({
        cursor: validCursor,
        keyword: 'design',
      });
      expect(parsed).toEqual({
        cursor: validCursor,
        keyword: 'design',
        limit: 50,
      });
    });

    it('rejects malformed cursor in pipe validation', () => {
      expect(() => pipe.transform({ cursor: 'invalid!cursor' })).toThrow(BadRequestException);
      expect(() => pipe.transform({ cursor: 'Cat|Name|id' })).toThrow(BadRequestException);
    });
  });

  describe('Response schema conformity', () => {
    it('validates returned page against skillCataloguePageSchema', async () => {
      const authRequest: RequestWithIdentity = {
        headers: {},
        user: { id: 'usr-student' },
      };

      const result = await controller.list({ limit: 50 }, authRequest);
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('nextCursor');
      expect(Array.isArray(result.items)).toBe(true);
      for (const item of result.items) {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('category');
        expect(item).toHaveProperty('levels');
        expect(item.levels).toEqual(['beginner', 'intermediate', 'advanced', 'expert']);
      }
      expect(typeof result.nextCursor).toBe('string');
      expect(decodeSkillCursor(result.nextCursor!)).toEqual([
        'Technology',
        'TypeScript Programming',
        '11111111-1111-4111-8111-111111111111',
      ]);
    });
  });
});
