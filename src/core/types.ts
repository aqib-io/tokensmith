import type { TokenSmithError } from './errors';

export type { TokenSmithError };

export interface StorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  clear(): void;
}

export type StorageType = 'cookie' | 'memory' | 'localStorage';

export interface TokenPair {
  accessToken: string;
  refreshToken?: string;
}

export interface RefreshConfig {
  endpoint?: string;
  handler?: (refreshToken: string) => Promise<TokenPair>;
  headers?: Record<string, string>;
  fetchOptions?: Omit<RequestInit, 'method' | 'headers' | 'body'>;
  /** Seconds before token expiry to proactively trigger a refresh. @defaultValue `60` */
  buffer?: number;
  /** Maximum retry attempts after a transient refresh failure. @defaultValue `3` */
  maxRetries?: number;
  /** Base delay in ms between retries (exponential backoff with jitter). @defaultValue `1000` */
  retryDelay?: number;
}

export interface CookieConfig {
  path?: string;
  domain?: string;
  sameSite?: 'strict' | 'lax' | 'none';
  /** Adds the `Secure` flag. Automatically enabled when `sameSite` is `'none'`. */
  secure?: boolean;
  maxAge?: number | 'auto';
}

export interface TokenManagerConfig {
  /** Storage backend. Defaults to `'cookie'`. Use `'memory'` for maximum XSS resistance. */
  storage?: StorageType | StorageAdapter;
  cookie?: CookieConfig;
  refresh?: RefreshConfig;
  syncTabs?: boolean;
  onAuthFailure?: () => void;
}

export interface AuthState<TUser = Record<string, unknown>> {
  isAuthenticated: boolean;
  user: TUser | null;
  accessToken: string | null;
  isRefreshing: boolean;
  error: TokenSmithError | null;
}

export type AuthStateListener<TUser = Record<string, unknown>> = (
  state: AuthState<TUser>
) => void;

export interface TokenManager<TUser = Record<string, unknown>> {
  setTokens(tokens: TokenPair): void;
  getAccessToken(): Promise<string | null>;
  getUser(): TUser | null;
  isAuthenticated(): boolean;
  onAuthChange(listener: AuthStateListener<TUser>): () => void;
  getState(): AuthState<TUser>;
  logout(): void;
  /** SSR helper. Extracts tokens from a `Cookie` request header. Returns `null` for non-cookie storage. */
  fromCookieHeader(cookieHeader: string): TokenPair | null;
  /** Returns a `fetch` wrapper that attaches `Authorization: Bearer` and retries once on 401. */
  createAuthFetch(): (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => Promise<Response>;
  getAuthHeader(): Promise<{ Authorization: string } | Record<string, never>>;
  /** Tears down timers, listeners, and sync channels. Do not call any other method on this instance after `destroy()`. */
  destroy(): void;
}
