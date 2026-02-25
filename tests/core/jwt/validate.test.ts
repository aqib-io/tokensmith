import { InvalidTokenError } from '@/core/errors';
import { getTimeUntilExpiry, isTokenExpired } from '@/core/jwt/validate';
import { createRawJwt, createTestJwt } from '../../helpers/create-test-jwt';

describe('isTokenExpired', () => {
  it('returns false for a token expiring in the future', () => {
    const token = createTestJwt({}, 3600);
    expect(isTokenExpired(token)).toBe(false);
  });

  it('returns true for an already-expired token', () => {
    const token = createTestJwt({}, -100);
    expect(isTokenExpired(token)).toBe(true);
  });

  it('returns false when token expires beyond the buffer window', () => {
    const token = createTestJwt({}, 120);
    expect(isTokenExpired(token, 60)).toBe(false);
  });

  it('returns true when token expires within the buffer window', () => {
    const token = createTestJwt({}, 30);
    expect(isTokenExpired(token, 60)).toBe(true);
  });

  it('returns false for a token without an exp claim', () => {
    const token = createRawJwt({ sub: 'user-1' });
    expect(isTokenExpired(token)).toBe(false);
  });

  it('throws InvalidTokenError for a malformed token', () => {
    expect(() => isTokenExpired('not.a.valid.jwt.string')).toThrow(
      InvalidTokenError
    );
  });

  it('considers clockSkewSeconds when evaluating expiry', () => {
    const token = createTestJwt({}, 5);
    expect(isTokenExpired(token, 0, 10)).toBe(true);
  });
});

describe('getTimeUntilExpiry', () => {
  it('returns the remaining seconds for a future token', () => {
    const token = createTestJwt({}, 3600);
    const time = getTimeUntilExpiry(token);

    expect(time).toBeGreaterThan(3598);
    expect(time).toBeLessThanOrEqual(3600);
  });

  it('returns a negative value for an expired token', () => {
    const token = createTestJwt({}, -100);
    expect(getTimeUntilExpiry(token)).toBeLessThan(0);
  });

  it('returns Infinity for a token without an exp claim', () => {
    const token = createRawJwt({ sub: 'user-1' });
    expect(getTimeUntilExpiry(token)).toBe(Infinity);
  });

  it('subtracts clockSkewSeconds from the reported remaining time', () => {
    const token = createTestJwt({}, 100);
    const withoutSkew = getTimeUntilExpiry(token);
    const withSkew = getTimeUntilExpiry(token, 10);

    expect(withSkew).toBeCloseTo(withoutSkew - 10, 1);
  });

  it('throws InvalidTokenError for a malformed token', () => {
    expect(() => getTimeUntilExpiry('bad')).toThrow(InvalidTokenError);
  });
});
