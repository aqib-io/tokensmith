import { TokenManagerImpl } from './token-manager';
import type { TokenManager, TokenManagerConfig } from './types';

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
export { TokenSmithError } from './types';
