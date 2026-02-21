import { StorageError } from '../errors';
import { decodeJwt } from '../jwt/decode';
import type { CookieConfig, StorageAdapter, TokenPair } from '../types';

const ACCESS_KEY = 'tk_access';
const REFRESH_KEY = 'tk_refresh';
const DEFAULT_PATH = '/';
const DEFAULT_SAME_SITE = 'strict' as const;

function parseCookieString(str: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const pair of str.split(';')) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const name = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (name) {
      result[name] = value;
    }
  }
  return result;
}

function capitalizeSameSite(sameSite: 'strict' | 'lax' | 'none'): string {
  return sameSite.charAt(0).toUpperCase() + sameSite.slice(1);
}

function resolveSecure(
  config: CookieConfig,
  sameSite: 'strict' | 'lax' | 'none'
): boolean {
  if (sameSite === 'none') return true;
  if (config.secure !== undefined) return config.secure;
  return typeof location !== 'undefined' && location.protocol === 'https:';
}

function resolveMaxAge(
  value: string,
  maxAge: number | 'auto' | undefined
): number | undefined {
  if (maxAge === undefined) return undefined;
  if (typeof maxAge === 'number') return maxAge;
  try {
    const payload = decodeJwt<{ exp?: number }>(value);
    if (payload.exp !== undefined) {
      return Math.max(0, payload.exp - Math.floor(Date.now() / 1000));
    }
  } catch {
    // Not a JWT or no exp — fall through to session cookie
  }
  return undefined;
}

function buildCookieString(
  key: string,
  value: string,
  config: CookieConfig
): string {
  const sameSite = config.sameSite ?? DEFAULT_SAME_SITE;
  const secure = resolveSecure(config, sameSite);
  const maxAge = resolveMaxAge(value, config.maxAge);

  const parts: string[] = [
    `${key}=${value}`,
    `Path=${config.path ?? DEFAULT_PATH}`,
    `SameSite=${capitalizeSameSite(sameSite)}`,
  ];

  if (config.domain) parts.push(`Domain=${config.domain}`);
  if (secure) parts.push('Secure');
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);

  return parts.join('; ');
}

function buildRemoveCookieString(key: string, config: CookieConfig): string {
  const parts: string[] = [
    `${key}=`,
    `Path=${config.path ?? DEFAULT_PATH}`,
    'Max-Age=0',
  ];
  if (config.domain) parts.push(`Domain=${config.domain}`);
  return parts.join('; ');
}

function resolveDocument(): Document {
  if (typeof document === 'undefined') {
    throw new StorageError(
      'Cookie storage is not available in this environment'
    );
  }
  return document;
}

export class CookieStorageAdapter implements StorageAdapter {
  private readonly config: CookieConfig;

  constructor(config: CookieConfig = {}) {
    this.config = config;
  }

  get(key: string): string | null {
    const doc = resolveDocument();
    const cookies = parseCookieString(doc.cookie);
    return cookies[key] ?? null;
  }

  set(key: string, value: string): void {
    const doc = resolveDocument();
    doc.cookie = buildCookieString(key, value, this.config);
  }

  remove(key: string): void {
    const doc = resolveDocument();
    doc.cookie = buildRemoveCookieString(key, this.config);
  }

  clear(): void {
    this.remove(ACCESS_KEY);
    this.remove(REFRESH_KEY);
  }

  fromCookieHeader(cookieHeader: string): TokenPair | null {
    const cookies = parseCookieString(cookieHeader);
    const accessToken = cookies[ACCESS_KEY];
    if (!accessToken) return null;
    const refreshToken = cookies[REFRESH_KEY];
    return {
      accessToken,
      ...(refreshToken !== undefined && { refreshToken }),
    };
  }
}
