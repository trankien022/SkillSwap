import { StudentVerificationController } from './student-verification.controller';
import type { StudentVerificationView } from '@skillswap/contracts';
import type { GetMyVerificationPort } from '../../../application/port/in/get-my-verification';

describe('StudentVerificationController nullable status transport', () => {
  const resource: StudentVerificationView = {
    id: 'verification-1', status: 'pending', schoolName: 'Test school', major: null,
    reviewerId: null, reason: null, decidedAt: null, submittedAt: '2026-10-12T00:00:00.000Z',
  };
  it.each([null, resource])('serializes the nullable resource as JSON and binds caller ownership', async (verification) => {
    const getMine: GetMyVerificationPort = { execute: jest.fn().mockResolvedValue(verification) };
    const unused = { execute: jest.fn() };
    const controller = new StudentVerificationController(unused, unused, unused, unused, getMine);
    const response = { json: jest.fn() };
    await controller.mine({ headers: {}, user: { id: 'caller-1', role: 'user' } }, response);
    expect(getMine.execute).toHaveBeenCalledWith('caller-1');
    expect(response.json).toHaveBeenCalledTimes(1);
    expect(response.json).toHaveBeenCalledWith(verification);
  });
});
