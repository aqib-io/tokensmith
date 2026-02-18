import { RefreshFailedError } from '../errors';
import { getTimeUntilExpiry } from '../jwt/validate';
import type { RefreshConfig, StorageAdapter, TokenPair } from '../types';
import { PromiseQueue } from './queue';

const DEFAULT_BUFFER = 60;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000;

export class RefreshManager {
  readonly queue: PromiseQueue<TokenPair>;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private onlineListener: (() => void) | null = null;

  constructor(
    private readonly config: RefreshConfig,
    private readonly storage: StorageAdapter,
    private readonly onRefresh: (tokens: TokenPair) => void,
    private readonly onFailure: (error: RefreshFailedError) => void
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
      this.forceRefresh().catch(() => {});
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
    this.cancelSchedule();
    if (this.onlineListener !== null) {
      window.removeEventListener('online', this.onlineListener);
      this.onlineListener = null;
    }
  }

  private async attemptRefreshWithRetry(): Promise<TokenPair> {
    const refreshToken = this.storage.get('tk_refresh');
    if (refreshToken === null) {
      throw new RefreshFailedError('No refresh token available', 0);
    }

    if (!this.config.handler && !this.config.endpoint) {
      throw new RefreshFailedError(
        'No refresh endpoint or handler configured',
        0
      );
    }

    const maxRetries = this.config.maxRetries ?? DEFAULT_MAX_RETRIES;
    const retryDelay = this.config.retryDelay ?? DEFAULT_RETRY_DELAY;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await this.waitForOnline();
      }

      try {
        const tokens = await this.executeRefresh(refreshToken);
        this.onRefresh(tokens);
        return tokens;
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          await this.sleep(retryDelay * 2 ** attempt);
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

    const response = await fetch(this.config.endpoint!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers,
      },
      body: JSON.stringify({ refreshToken }),
      ...this.config.fetchOptions,
    });

    if (!response.ok) {
      throw new RefreshFailedError(
        `Refresh request failed with status ${response.status}`,
        0
      );
    }

    return (await response.json()) as TokenPair;
  }

  private waitForOnline(): Promise<void> {
    return new Promise((resolve) => {
      const handler = () => {
        window.removeEventListener('online', handler);
        this.onlineListener = null;
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
