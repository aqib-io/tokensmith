export interface StorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  clear(): void;
}

export type StorageType = 'cookie' | 'memory' | 'localStorage';

export class TokenSmithError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'TokenSmithError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface TokenPair {
  accessToken: string;
  refreshToken?: string;
}

export interface RefreshConfig {
  endpoint?: string;
  handler?: (refreshToken: string) => Promise<TokenPair>;
  headers?: Record<string, string>;
  fetchOptions?: Omit<RequestInit, 'method' | 'headers' | 'body'>;
  buffer?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export interface CookieConfig {
  path?: string;
  domain?: string;
  sameSite?: 'strict' | 'lax' | 'none';
  secure?: boolean;
  maxAge?: number | 'auto';
}

export interface TokenManagerConfig {
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
  fromCookieHeader(cookieHeader: string): TokenPair | null;
  createAuthFetch(): (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => Promise<Response>;
  getAuthHeader(): Promise<{ Authorization: string } | Record<string, never>>;
  destroy(): void;
}
