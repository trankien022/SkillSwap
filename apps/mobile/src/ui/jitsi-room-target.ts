import type { RoomAccessResponse } from '@skillswap/contracts';

/** Convert the API's public JaaS URL into the tenant-prefixed room expected by the native SDK. */
export function getJaasRoomTarget(access: Pick<RoomAccessResponse, 'room' | 'url'>) {
  const url = new URL(access.url);
  if (
    url.protocol !== 'https:' ||
    url.hostname !== '8x8.vc' ||
    url.port !== '' ||
    url.username !== '' ||
    url.password !== '' ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    throw new Error('Unexpected JaaS host');
  }

  const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (segments.length !== 2 || segments.some((segment) => !/^[a-zA-Z0-9_-]+$/.test(segment)) || segments[1] !== access.room) {
    throw new Error('Unexpected JaaS room URL');
  }

  return { serverURL: 'https://8x8.vc', room: `${segments[0]}/${segments[1]}` };
}
