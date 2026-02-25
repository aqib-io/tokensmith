function base64UrlEncode(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function utf8Base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const bin = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function createTestJwt(
  payload?: Record<string, unknown>,
  expiresInSeconds?: number
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const fullPayload = {
    sub: 'user-1',
    email: 'test@test.com',
    ...payload,
    exp: now + (expiresInSeconds ?? 3600),
  };

  return `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(fullPayload))}.test`;
}

export function createRawJwt(payload: Record<string, unknown>): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  return `${header}.${base64UrlEncode(JSON.stringify(payload))}.sig`;
}

export function createUtf8Jwt(payload: Record<string, unknown>): string {
  const header = utf8Base64UrlEncode(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' })
  );
  return `${header}.${utf8Base64UrlEncode(JSON.stringify(payload))}.sig`;
}
