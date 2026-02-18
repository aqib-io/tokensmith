function base64UrlEncode(value: string): string {
  return btoa(value)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

export function createTestJwt(
  payload?: Record<string, unknown>,
  expiresInSeconds?: number,
): string {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'HS256', typ: 'JWT' }
  const fullPayload = {
    sub: 'user-1',
    email: 'test@test.com',
    ...payload,
    exp: now + (expiresInSeconds ?? 3600),
  }

  return `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(fullPayload))}.test`
}
