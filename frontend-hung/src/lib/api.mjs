// Client dành cho bản demo.
// Khi triển khai production, nên dùng phiên qua cookie HttpOnly.
const KEY = 'skillswap-api-tokens';
const REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;
const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || '/backend')
  .replace(/\/$/, '');

let refreshInFlight = null;
let sessionVersion = 0;

function readSession() {
  if (typeof window === 'undefined') return null;

  for (const storage of [window.sessionStorage, window.localStorage]) {
    const raw = storage.getItem(KEY);
    if (!raw) continue;

    try {
      const value = JSON.parse(raw);

      if (
        !value?.accessToken ||
        !value?.refreshToken ||
        (value.rememberUntil && Date.now() >= value.rememberUntil)
      ) {
        storage.removeItem(KEY);
        continue;
      }

      return {
        value,
        remembered: storage === window.localStorage,
      };
    } catch {
      storage.removeItem(KEY);
    }
  }

  return null;
}

export function tokens() {
  return readSession()?.value || null;
}

export function clearSession() {
  sessionVersion++;
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(KEY);
  window.localStorage.removeItem(KEY);
}

function saveTokens(pair, remembered, rememberUntil) {
  if (!pair?.accessToken || !pair?.refreshToken) {
    throw new Error('Backend trả về token không hợp lệ.');
  }

  const value = {
    accessToken: pair.accessToken,
    refreshToken: pair.refreshToken,
    expiresIn: pair.expiresIn,
    tokenType: pair.tokenType,
    ...(remembered ? { rememberUntil } : {}),
  };

  window.sessionStorage.removeItem(KEY);
  window.localStorage.removeItem(KEY);

  const storage = remembered
    ? window.localStorage
    : window.sessionStorage;

  storage.setItem(KEY, JSON.stringify(value));
}

async function decode(response) {
  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(', ')
      : data?.message ||
        `Lỗi API (${response.status}). Kiểm tra gateway đang chạy.`;

    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
}

async function send(
  path,
  { method = 'GET', body, auth = true, signal } = {}
) {
  const headers = {};

  if (body !== undefined) {
    headers['content-type'] = 'application/json';
  }

  const current = tokens();
  if (auth && current) {
    headers.authorization = `Bearer ${current.accessToken}`;
  }

  try {
    return await fetch(`${BASE}/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      cache: 'no-store',
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error(
      'Không kết nối được backend. Kiểm tra gateway và địa chỉ API.'
    );
  }
}

async function refresh() {
  if (refreshInFlight) return refreshInFlight;

  const session = readSession();
  if (!session) {
    clearSession();
    throw new Error('Phiên đã hết hạn. Hãy đăng nhập lại.');
  }

  const version = sessionVersion;

  refreshInFlight = (async () => {
    try {
      const pair = await decode(
        await send('/auth/refresh', {
          method: 'POST',
          body: { refreshToken: session.value.refreshToken },
          auth: false,
        })
      );

      if (
        version !== sessionVersion ||
        tokens()?.refreshToken !== session.value.refreshToken
      ) {
        throw new Error('Phiên đã thay đổi. Hãy tải lại trang.');
      }

      if (
        session.remembered &&
        Date.now() >= session.value.rememberUntil
      ) {
        clearSession();
        throw new Error('Phiên đã hết hạn. Hãy đăng nhập lại.');
      }

      // Giữ mốc 30 ngày ban đầu, không kéo dài mỗi lần refresh.
      saveTokens(
        pair,
        session.remembered,
        session.value.rememberUntil
      );
    } catch (error) {
      if (
        version === sessionVersion &&
        tokens()?.refreshToken === session.value.refreshToken &&
        [400, 401, 403, 404].includes(error.status)
      ) {
        clearSession();
      }
      throw error;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function api(path, options = {}) {
  let response = await send(path, options);

  if (
    response.status === 401 &&
    options.auth !== false &&
    tokens()?.refreshToken
  ) {
    await refresh();
    response = await send(path, options);
  }

  try {
    return await decode(response);
  } catch (error) {
    if (error.status === 401 && options.auth !== false) {
      clearSession();
    }
    throw error;
  }
}

export async function authenticate(mode, body, remember = false) {
  const pair = await api('/auth/' + mode, {
    method: 'POST',
    body,
    auth: false,
  });

  clearSession();
  saveTokens(
    pair,
    remember,
    remember ? Date.now() + REMEMBER_MS : undefined
  );

  return pair;
}

export async function logout() {
  const refreshToken = tokens()?.refreshToken;

  // Xóa ngay để một yêu cầu refresh đang chạy không phục hồi phiên.
  clearSession();

  if (refreshToken) {
    await api('/auth/logout', {
      method: 'POST',
      body: { refreshToken },
      auth: false,
    });
  }
}