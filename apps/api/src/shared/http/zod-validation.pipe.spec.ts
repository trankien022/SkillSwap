import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

const schema = z.object({ name: z.string().min(1), age: z.number().int().nonnegative() });

describe('ZodValidationPipe', () => {
  it('returns parsed data for valid input', () => {
    const pipe = new ZodValidationPipe(schema);
    expect(pipe.transform({ name: 'ada', age: 36 })).toEqual({ name: 'ada', age: 36 });
  });

  it('throws BadRequestException with issue details for invalid input', () => {
    const pipe = new ZodValidationPipe(schema);
    expect(() => pipe.transform({ name: '', age: -1 })).toThrow(BadRequestException);
    try {
      pipe.transform({ name: '', age: -1 });
    } catch (error) {
      expect((error as BadRequestException).getResponse()).toMatchObject({
        message: expect.stringContaining('name'),
      });
      expect((error as BadRequestException).getResponse()).toMatchObject({
        message: expect.stringContaining('age'),
      });
    }
  });

  it('rejects non-objects', () => {
    const pipe = new ZodValidationPipe(schema);
    expect(() => pipe.transform('nope')).toThrow(BadRequestException);
  });
});
