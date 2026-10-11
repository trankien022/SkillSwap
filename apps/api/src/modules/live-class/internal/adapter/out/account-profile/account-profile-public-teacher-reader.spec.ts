import { AccountProfilePublicTeacherReader } from './account-profile-public-teacher-reader';
import type { PublicProfileReader } from '../../../../../account-profile/api';

describe('AccountProfilePublicTeacherReader', () => {
  it('maps public profiles from AccountProfile public reader facade', async () => {
    const mockProfileReader: jest.Mocked<PublicProfileReader> = {
      readMany: jest.fn().mockResolvedValue([
        { id: 't-1', displayName: 'Teacher Alice' },
        { id: 't-2', displayName: 'Teacher Bob' },
      ]),
    };

    const adapter = new AccountProfilePublicTeacherReader(mockProfileReader);
    const result = await adapter.readMany(['t-1', 't-2']);

    expect(mockProfileReader.readMany).toHaveBeenCalledWith(['t-1', 't-2']);
    expect(result).toEqual([
      { id: 't-1', displayName: 'Teacher Alice' },
      { id: 't-2', displayName: 'Teacher Bob' },
    ]);
  });

  it('returns empty array early when teacherIds is empty', async () => {
    const mockProfileReader: jest.Mocked<PublicProfileReader> = {
      readMany: jest.fn(),
    };

    const adapter = new AccountProfilePublicTeacherReader(mockProfileReader);
    const result = await adapter.readMany([]);

    expect(result).toEqual([]);
    expect(mockProfileReader.readMany).not.toHaveBeenCalled();
  });
});
