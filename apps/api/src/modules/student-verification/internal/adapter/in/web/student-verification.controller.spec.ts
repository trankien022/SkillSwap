import { StudentVerificationController } from './student-verification.controller';
import type { StudentVerificationView } from '@skillswap/contracts';
import type { GetMyVerificationPort } from '../../../application/port/in/get-my-verification';

describe('StudentVerificationController nullable status transport', () => {
  const resource: StudentVerificationView = {
    id: 'verification-1', status: 'pending', schoolName: 'Test school', major: null,
    reviewerId: null, reason: null, decidedAt: null, submittedAt: '2026-10-12T00:00:00.000Z',
  };
  it.each([null, resource])('returns the nullable resource and binds caller ownership', async (verification) => {
    const getMine: GetMyVerificationPort = { execute: jest.fn().mockResolvedValue(verification) };
    const unused = { execute: jest.fn() };
    const controller = new StudentVerificationController(unused, unused, unused, unused, getMine);
    await expect(controller.mine({ headers: {}, user: { id: 'caller-1', role: 'user' } })).resolves.toEqual(verification);
    expect(getMine.execute).toHaveBeenCalledWith('caller-1');
  });
});
