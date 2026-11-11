import { getJaasRoomTarget } from './jitsi-room-target';

describe('getJaasRoomTarget', () => {
  it('keeps the JaaS tenant in the SDK room and uses the JaaS server URL', () => {
    expect(
      getJaasRoomTarget({
        room: 'skillswap-class-123',
        url: 'https://8x8.vc/app-id/skillswap-class-123',
      }),
    ).toEqual({ serverURL: 'https://8x8.vc', room: 'app-id/skillswap-class-123' });
  });

  it.each([
    'http://8x8.vc/app-id/skillswap-class-123',
    'https://8x8.vc/app%2Fother/skillswap-class-123',
    'https://8x8.vc/%2E%2E/skillswap-class-123',
    'https://evil.example/app-id/skillswap-class-123',
    'https://8x8.vc:444/app-id/skillswap-class-123',
    'https://user@8x8.vc/app-id/skillswap-class-123',
    'https://8x8.vc/app-id/skillswap-class-123?token=unexpected',
    'https://8x8.vc/app-id/another-room',
    'https://8x8.vc/app-id/skillswap-class-123/extra',
  ])('rejects malformed or unexpected URL %s', (url) => {
    expect(() => getJaasRoomTarget({ room: 'skillswap-class-123', url })).toThrow();
  });
});
