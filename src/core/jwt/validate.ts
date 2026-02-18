import { decodeJwt } from './decode';

interface JwtPayload {
  exp?: number;
}

export function isTokenExpired(
  token: string,
  bufferSeconds = 0,
  clockSkewSeconds = 0
): boolean {
  const { exp } = decodeJwt<JwtPayload>(token);
  if (exp === undefined) return false;
  const now = Date.now() / 1000;
  return exp - bufferSeconds <= now + clockSkewSeconds;
}

export function getTimeUntilExpiry(
  token: string,
  clockSkewSeconds = 0
): number {
  const { exp } = decodeJwt<JwtPayload>(token);
  if (exp === undefined) return Infinity;
  const now = Date.now() / 1000;
  return exp - now - clockSkewSeconds;
}
