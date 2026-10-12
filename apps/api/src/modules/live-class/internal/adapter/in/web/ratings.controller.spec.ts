import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { RatingsController } from './ratings.controller';
import { RatingAlreadyExistsError } from '../../../application/port/in/submit-rating';

describe('RatingsController', () => {
  const request = (id?: string) => ({ user: id ? { id } : undefined } as never);
  it('rejects anonymous and maps duplicate booking ratings to conflict', async () => {
    const submit = { execute: jest.fn().mockRejectedValue(new RatingAlreadyExistsError()) };
    const controller = new RatingsController(submit);
    await expect(controller.create('b1', { stars: 5, comment: 'Nice' }, request())).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.create('b1', { stars: 5, comment: 'Nice' }, request('u1'))).rejects.toBeInstanceOf(ConflictException);
  });
});
