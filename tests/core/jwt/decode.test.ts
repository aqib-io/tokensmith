import { InvalidTokenError } from '@/core/errors';
import { decodeJwt } from '@/core/jwt/decode';
import { createTestJwt } from '../../helpers/create-test-jwt';

const makeJwt = (payload: Record<string, unknown>): string => {
  const enc = (s: string) =>
    btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const header = enc(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  return `${header}.${enc(JSON.stringify(payload))}.sig`;
};

const makeUtf8Jwt = (payload: Record<string, unknown>): string => {
  const enc = (s: string) => {
    const bytes = new TextEncoder().encode(s);
    const bin = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  };
  const header = enc(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  return `${header}.${enc(JSON.stringify(payload))}.sig`;
};

describe('decodeJwt', () => {
  it('decodes a valid JWT and returns the payload', () => {
    const token = createTestJwt({ name: 'Alice', role: 'admin' });
    const payload = decodeJwt<{
      sub: string;
      email: string;
      name: string;
      role: string;
      exp: number;
    }>(token);

    expect(payload.sub).toBe('user-1');
    expect(payload.email).toBe('test@test.com');
    expect(payload.name).toBe('Alice');
    expect(payload.role).toBe('admin');
    expect(typeof payload.exp).toBe('number');
  });

  it('throws InvalidTokenError when token has fewer than 3 segments', () => {
    expect(() => decodeJwt('header.payload')).toThrow(InvalidTokenError);
  });

  it('throws InvalidTokenError when token has more than 3 segments', () => {
    expect(() => decodeJwt('a.b.c.d')).toThrow(InvalidTokenError);
  });

  it('throws InvalidTokenError for invalid base64 in the payload segment', () => {
    expect(() => decodeJwt('eyJhbGciOiJIUzI1NiJ9.!!!invalid!!!.sig')).toThrow(
      InvalidTokenError
    );
  });

  it('throws InvalidTokenError when payload is valid base64 but not JSON', () => {
    const notJson = btoa('not-json')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    expect(() => decodeJwt(`eyJhbGciOiJIUzI1NiJ9.${notJson}.sig`)).toThrow(
      InvalidTokenError
    );
  });

  it('decodes a token with unicode characters in the payload', () => {
    const token = makeUtf8Jwt({ name: 'Ångström', emoji: '🔐', sub: 'user-1' });
    const payload = decodeJwt<{ name: string; emoji: string; sub: string }>(
      token
    );

    expect(payload.name).toBe('Ångström');
    expect(payload.emoji).toBe('🔐');
    expect(payload.sub).toBe('user-1');
  });

  it('decodes a token without an exp claim', () => {
    const token = makeJwt({ sub: 'user-1', iss: 'test' });
    const payload = decodeJwt<{ sub: string; iss: string; exp?: number }>(
      token
    );

    expect(payload.sub).toBe('user-1');
    expect(payload.iss).toBe('test');
    expect(payload.exp).toBeUndefined();
  });

  it('throws InvalidTokenError for an empty string', () => {
    expect(() => decodeJwt('')).toThrow(InvalidTokenError);
  });
});
