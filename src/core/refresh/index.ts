import { REFRESH_KEY } from '../constants';
import { NetworkError, RefreshFailedError } from '../errors';
import { getTimeUntilExpiry } from '../jwt/validate';
import type { RefreshConfig, StorageAdapter, TokenPair } from '../types';
import { PromiseQueue } from './queue';

const DEFAULT_BUFFER = 60;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000;

export class RefreshManager {
  private readonly queue: PromiseQueue<TokenPair>;

  get isRefreshing(): boolean {
    return this.queue.isExecuting;
  }
  private timer: ReturnType<typeof setTimeout> | null = null;
  private onlineListener: (() => void) | null = null;
  private onlineReject: (() => void) | null = null;
  private controller: AbortController | null = null;
  private destroyed = false;

  constructor(
    private readonly config: RefreshConfig,
    private readonly storage: StorageAdapter,
    private readonly onRefresh: (tokens: TokenPair) => void,
    private readonly onFailure: (error: RefreshFailedError) => void,
    private readonly onSettled?: () => void
  ) {
    this.queue = new PromiseQueue<TokenPair>();
  }

  scheduleRefresh(accessToken: string): void {
    this.cancelSchedule();
    const buffer = this.config.buffer ?? DEFAULT_BUFFER;
    const timeUntilExpiry = getTimeUntilExpiry(accessToken);
    if (!Number.isFinite(timeUntilExpiry)) return;
    const delay = Math.max(0, (timeUntilExpiry - buffer) * 1000);
    this.timer = setTimeout(() => {
      this.forceRefresh()
        .finally(() => this.onSettled?.())
        .catch(() => {});
    }, delay);
  }

  async forceRefresh(): Promise<TokenPair> {
    return this.queue.execute(() => this.attemptRefreshWithRetry());
  }

  cancelSchedule(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.cancelSchedule();
    this.controller?.abort();
    if (this.onlineListener !== null) {
      window.removeEventListener('online', this.onlineListener);
      this.onlineListener = null;
    }
    this.onlineReject?.();
    this.onlineReject = null;
  }

  private async attemptRefreshWithRetry(): Promise<TokenPair> {
    const refreshToken = this.storage.get(REFRESH_KEY);
    if (refreshToken === null) {
      const error = new RefreshFailedError('No refresh token available', 0);
      this.onFailure(error);
      throw error;
    }

    if (!this.config.handler && !this.config.endpoint) {
      const error = new RefreshFailedError(
        'No refresh endpoint or handler configured',
        0
      );
      this.onFailure(error);
      throw error;
    }

    const maxRetries = this.config.maxRetries ?? DEFAULT_MAX_RETRIES;
    const retryDelay = this.config.retryDelay ?? DEFAULT_RETRY_DELAY;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (this.destroyed) throw new RefreshFailedError('Refresh aborted', 0);

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await this.waitForOnline();
      }

      try {
        const tokens = await this.executeRefresh(refreshToken);
        this.onRefresh(tokens);
        return tokens;
      } catch (error) {
        if (error instanceof RefreshFailedError) throw error;
        if (this.controller?.signal.aborted)
          throw new RefreshFailedError('Refresh aborted', 0);
        lastError = error;
        if (attempt < maxRetries) {
          const jitter = Math.random() * retryDelay * 0.5;
          await this.sleep(retryDelay * 2 ** attempt + jitter);
        }
      }
    }

    const message =
      lastError instanceof Error ? lastError.message : 'Refresh failed';
    const error = new RefreshFailedError(message, maxRetries + 1);
    this.onFailure(error);
    throw error;
  }

  private async executeRefresh(refreshToken: string): Promise<TokenPair> {
    if (this.config.handler) {
      return this.config.handler(refreshToken);
    }

    this.controller = new AbortController();
    const response = await fetch(this.config.endpoint!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers,
      },
      body: JSON.stringify({ refreshToken }),
      ...this.config.fetchOptions,
      signal: this.controller.signal,
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        const error = new RefreshFailedError(
          `Refresh token rejected (HTTP ${response.status})`,
          0
        );
        this.onFailure(error);
        throw error;
      }
      throw new NetworkError(
        `Refresh request failed with status ${response.status}`
      );
    }

    const result = (await response.json()) as Record<string, unknown>;
    if (typeof result.accessToken !== 'string' || !result.accessToken) {
      throw new NetworkError(
        'Invalid refresh response: missing or empty accessToken'
      );
    }
    if (
      result.refreshToken !== undefined &&
      typeof result.refreshToken !== 'string'
    ) {
      throw new NetworkError(
        'Invalid refresh response: refreshToken must be a string'
      );
    }
    return {
      accessToken: result.accessToken,
      ...(typeof result.refreshToken === 'string' && {
        refreshToken: result.refreshToken,
      }),
    };
  }

  private waitForOnline(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.onlineReject = () =>
        reject(new RefreshFailedError('Destroyed while waiting for online', 0));
      const handler = () => {
        window.removeEventListener('online', handler);
        this.onlineListener = null;
        this.onlineReject = null;
        resolve();
      };
      this.onlineListener = handler;
      window.addEventListener('online', handler);
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
