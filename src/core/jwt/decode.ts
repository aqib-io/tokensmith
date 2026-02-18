import { InvalidTokenError } from '../errors';

function base64UrlDecode(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    '='
  );
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function decodeJwt<T>(token: string): T {
  const parts = token.split('.');

  if (parts.length !== 3) {
    throw new InvalidTokenError('Invalid JWT format: expected 3 segments');
  }

  const [, payloadSegment] = parts;

  if (!payloadSegment) {
    throw new InvalidTokenError('Invalid JWT format: missing payload segment');
  }

  try {
    const decoded = base64UrlDecode(payloadSegment);
    return JSON.parse(decoded) as T;
  } catch (err) {
    if (err instanceof InvalidTokenError) {
      throw err;
    }
    throw new InvalidTokenError('Invalid JWT: malformed payload');
  }
}
