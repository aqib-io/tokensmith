import { ACCESS_KEY, REFRESH_KEY } from './constants';
import type { RefreshFailedError } from './errors';
import { decodeJwt } from './jwt/decode';
import { isTokenExpired } from './jwt/validate';
import { RefreshManager } from './refresh';
import { createStorage } from './storage';
import { parseCookieString } from './storage/cookie';
import { TabSyncManager } from './sync';
import type { SyncEvent } from './sync/types';
import type {
  AuthState,
  AuthStateListener,
  StorageAdapter,
  TokenManager,
  TokenManagerConfig,
  TokenPair,
} from './types';

export class TokenManagerImpl<TUser = Record<string, unknown>>
  implements TokenManager<TUser>
{
  private readonly config: TokenManagerConfig;
  private readonly storage: StorageAdapter;
  private readonly refreshManager: RefreshManager | null;
  private readonly syncManager: TabSyncManager | null;
  private readonly listeners: Set<AuthStateListener<TUser>>;
  private state: AuthState<TUser>;
  private visibilityHandler: (() => void) | null = null;
  private cachedUser: { token: string; user: TUser | null } | null = null;
  private pendingError: RefreshFailedError | null = null;

  constructor(config: TokenManagerConfig) {
    this.config = config;
    this.storage = createStorage(config);
    this.listeners = new Set();
    this.refreshManager = config.refresh
      ? new RefreshManager(
          config.refresh,
          this.storage,
          (tokens) => this.applyRefreshedTokens(tokens),
          (error) => this.handleRefreshFailure(error),
          () => this.updateState()
        )
      : null;

    this.state = this.computeState();

    const accessToken = this.storage.get(ACCESS_KEY);
    if (
      accessToken !== null &&
      this.isTokenValid(accessToken) &&
      this.refreshManager !== null
    ) {
      this.refreshManager.scheduleRefresh(accessToken);
    }

    const shouldSync = config.syncTabs !== false && config.storage !== 'memory';
    this.syncManager = shouldSync
      ? new TabSyncManager(config.syncChannelName ?? 'tokensmith', (event) =>
          this.handleSyncEvent(event)
        )
      : null;
    this.syncManager?.start();

    if (typeof document !== 'undefined') {
      this.visibilityHandler = () => {
        if (document.visibilityState === 'visible') {
          const token = this.storage.get(ACCESS_KEY);
          if (
            token !== null &&
            !this.isTokenValid(token) &&
            this.refreshManager !== null
          ) {
            this.refreshManager.forceRefresh().catch(() => {});
          }
          this.updateState();
        }
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  setTokens(tokens: TokenPair): void {
    this.storeTokens(tokens);
    this.syncManager?.broadcast({ type: 'TOKEN_SET' });
  }

  async getAccessToken(): Promise<string | null> {
    const token = this.storage.get(ACCESS_KEY);
    if (token === null) return null;
    if (this.isTokenValid(token)) return token;
    if (this.refreshManager !== null) {
      const newTokens = await this.refreshManager.forceRefresh();
      return newTokens.accessToken;
    }
    return null;
  }

  getUser(): TUser | null {
    const token = this.storage.get(ACCESS_KEY);
    if (!this.isTokenValid(token)) return null;
    return this.safeDecodeUser(token);
  }

  isAuthenticated(): boolean {
    return this.isTokenValid(this.storage.get(ACCESS_KEY));
  }

  onAuthChange(listener: AuthStateListener<TUser>): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): AuthState<TUser> {
    return this.state;
  }

  logout(): void {
    this.pendingError = null;
    this.refreshManager?.cancelSchedule();
    this.storage.clear();
    this.syncManager?.broadcast({ type: 'TOKEN_CLEARED' });
    this.updateState();
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

  createAuthFetch(): (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => Promise<Response> {
    return async (input, init) => {
      const authHeader = await this.getAuthHeader();
      const headers = new Headers(init?.headers);
      for (const [key, value] of Object.entries(authHeader)) {
        headers.set(key, value);
      }

      const response = await fetch(input, { ...init, headers });

      if (response.status === 401 && this.refreshManager !== null) {
        try {
          await this.refreshManager.forceRefresh();
          const newAuthHeader = await this.getAuthHeader();
          const retryHeaders = new Headers(init?.headers);
          for (const [key, value] of Object.entries(newAuthHeader)) {
            retryHeaders.set(key, value);
          }
          return fetch(input, { ...init, headers: retryHeaders });
        } catch {
          return response;
        }
      }

      return response;
    };
  }

  async getAuthHeader(): Promise<
    { Authorization: string } | Record<string, never>
  > {
    const token = await this.getAccessToken();
    if (token === null) return {};
    return { Authorization: `Bearer ${token}` };
  }

  destroy(): void {
    this.refreshManager?.destroy();
    this.syncManager?.destroy();
    this.listeners.clear();
    if (this.visibilityHandler !== null) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  private isTokenValid(token: string | null): boolean {
    if (token === null) return false;
    try {
      return !isTokenExpired(token);
    } catch {
      return false;
    }
  }

  private safeDecodeUser(token: string | null): TUser | null {
    if (token === null) return null;
    try {
      return decodeJwt<TUser>(token);
    } catch {
      return null;
    }
  }

  private storeTokens(tokens: TokenPair): void {
    this.pendingError = null;
    this.storage.set(ACCESS_KEY, tokens.accessToken);
    if (tokens.refreshToken !== undefined) {
      this.storage.set(REFRESH_KEY, tokens.refreshToken);
    }
    this.refreshManager?.scheduleRefresh(tokens.accessToken);
    this.updateState();
  }

  private computeState(): AuthState<TUser> {
    const token = this.storage.get(ACCESS_KEY);
    const isAuth = this.isTokenValid(token);
    let user: TUser | null = null;
    if (isAuth && token !== null) {
      if (this.cachedUser?.token === token) {
        user = this.cachedUser.user;
      } else {
        user = this.safeDecodeUser(token);
        this.cachedUser = { token, user };
      }
    } else {
      this.cachedUser = null;
    }
    return {
      isAuthenticated: isAuth,
      user,
      accessToken: isAuth ? token : null,
      isRefreshing: this.refreshManager?.isRefreshing ?? false,
      error: this.pendingError,
    };
  }

  private updateState(): void {
    const newState = this.computeState();
    const s = this.state;
    if (
      s.isAuthenticated === newState.isAuthenticated &&
      s.accessToken === newState.accessToken &&
      s.isRefreshing === newState.isRefreshing &&
      s.error === newState.error &&
      s.user === newState.user
    ) {
      return;
    }
    this.state = newState;
    for (const listener of this.listeners) {
      listener(newState);
    }
  }

  private applyRefreshedTokens(tokens: TokenPair): void {
    this.storeTokens(tokens);
    this.syncManager?.broadcast({ type: 'TOKEN_REFRESHED' });
  }

  private handleRefreshFailure(error: RefreshFailedError): void {
    this.pendingError = error;
    const fresh = this.computeState();
    // isRefreshing override: the queue's isExecuting flag is still true at this
    // point because the finally block in PromiseQueue runs after this callback.
    this.state = { ...fresh, isRefreshing: false };
    for (const listener of this.listeners) {
      listener(this.state);
    }
    this.config.onAuthFailure?.();
  }

  private handleSyncEvent(event: SyncEvent): void {
    if (event.type === 'TOKEN_CLEARED') {
      this.refreshManager?.cancelSchedule();
      this.storage.clear();
    } else if (event.type === 'TOKEN_SET' || event.type === 'TOKEN_REFRESHED') {
      const token = this.storage.get(ACCESS_KEY);
      if (token !== null && this.isTokenValid(token)) {
        this.refreshManager?.scheduleRefresh(token);
      }
    }
    this.updateState();
  }
}
