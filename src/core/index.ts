import { TokenManagerImpl } from './token-manager';
import type { TokenManager, TokenManagerConfig } from './types';

/**
 * Creates a new {@link TokenManager} instance.
 *
 * @example
 * ```ts
 * const auth = createTokenManager({
 *   storage: 'localStorage',
 *   refresh: { endpoint: '/api/auth/refresh' },
 *   onAuthFailure: () => router.push('/login'),
 * });
 * ```
 */
export function createTokenManager<TUser = Record<string, unknown>>(
  config: TokenManagerConfig = {}
): TokenManager<TUser> {
  return new TokenManagerImpl<TUser>(config);
}

export {
  InvalidTokenError,
  NetworkError,
  RefreshFailedError,
  StorageError,
  TokenExpiredError,
  TokenSmithError,
} from './errors';
export type {
  AuthState,
  AuthStateListener,
  CookieConfig,
  RefreshConfig,
  StorageAdapter,
  StorageType,
  TokenManager,
  TokenManagerConfig,
  TokenPair,
} from './types';
