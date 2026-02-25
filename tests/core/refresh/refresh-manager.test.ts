import { RefreshFailedError } from '@/core/errors';
import { RefreshManager } from '@/core/refresh';
import { MemoryStorageAdapter } from '@/core/storage/memory';
import type { TokenPair } from '@/core/types';
import { createTestJwt } from '../../helpers/create-test-jwt';

const makeJwtNoExp = (): string => {
  const enc = (s: string) =>
    btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${enc(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${enc(JSON.stringify({ sub: 'user-1' }))}.sig`;
};

describe('RefreshManager', () => {
  describe('forceRefresh — handler mode', () => {
    it('calls the configured handler with the stored refresh token', async () => {
      const storage = new MemoryStorageAdapter();
      storage.set('tk_refresh', 'stored-rt');
      const handler = vi.fn().mockResolvedValueOnce({ accessToken: 'new-at' });
      const manager = new RefreshManager(
        { handler },
        storage,
        vi.fn(),
        vi.fn()
      );

      await manager.forceRefresh();

      expect(handler).toHaveBeenCalledWith('stored-rt');
      manager.destroy();
    });

    it('invokes onRefresh with the returned token pair on success', async () => {
      const storage = new MemoryStorageAdapter();
      storage.set('tk_refresh', 'rt');
      const newTokens: TokenPair = {
        accessToken: 'new-at',
        refreshToken: 'new-rt',
      };
      const handler = vi.fn().mockResolvedValueOnce(newTokens);
      const onRefresh = vi.fn();
      const manager = new RefreshManager(
        { handler },
        storage,
        onRefresh,
        vi.fn()
      );

      await manager.forceRefresh();

      expect(onRefresh).toHaveBeenCalledWith(newTokens);
      manager.destroy();
    });

    it('passes the rotated refreshToken in the token pair to onRefresh', async () => {
      const storage = new MemoryStorageAdapter();
      storage.set('tk_refresh', 'old-rt');
      const handler = vi.fn().mockResolvedValueOnce({
        accessToken: 'rotated-at',
        refreshToken: 'rotated-rt',
      });
      const onRefresh = vi.fn((tokens: TokenPair) => {
        storage.set('tk_access', tokens.accessToken);
        if (tokens.refreshToken !== undefined) {
          storage.set('tk_refresh', tokens.refreshToken);
        }
      });
      const manager = new RefreshManager(
        { handler },
        storage,
        onRefresh,
        vi.fn()
      );

      await manager.forceRefresh();

      expect(storage.get('tk_refresh')).toBe('rotated-rt');
      manager.destroy();
    });

    it('deduplicates concurrent calls — handler runs exactly once', async () => {
      const storage = new MemoryStorageAdapter();
      storage.set('tk_refresh', 'rt');
      let resolveHandler!: (value: TokenPair) => void;
      const controlled = new Promise<TokenPair>((r) => {
        resolveHandler = r;
      });
      const handler = vi.fn(() => controlled);
      const manager = new RefreshManager(
        { handler },
        storage,
        vi.fn(),
        vi.fn()
      );

      const p1 = manager.forceRefresh();
      const p2 = manager.forceRefresh();
      const p3 = manager.forceRefresh();
      resolveHandler({ accessToken: 'at' });

      const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(r1.accessToken).toBe('at');
      expect(r2.accessToken).toBe('at');
      expect(r3.accessToken).toBe('at');
      manager.destroy();
    });
  });

  describe('forceRefresh — endpoint mode', () => {
    it('POSTs to the configured endpoint with the refresh token in the request body', async () => {
      const storage = new MemoryStorageAdapter();
      storage.set('tk_refresh', 'stored-rt');
      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({ accessToken: 'new-at' }),
      });
      vi.stubGlobal('fetch', fetchMock);
      const manager = new RefreshManager(
        { endpoint: '/api/refresh' },
        storage,
        vi.fn(),
        vi.fn()
      );

      await manager.forceRefresh();

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/refresh',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ refreshToken: 'stored-rt' }),
        })
      );
      manager.destroy();
    });

    it('throws RefreshFailedError when the endpoint returns a non-ok response', async () => {
      const storage = new MemoryStorageAdapter();
      storage.set('tk_refresh', 'rt');
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 401 })
      );
      const manager = new RefreshManager(
        { endpoint: '/api/refresh', maxRetries: 0 },
        storage,
        vi.fn(),
        vi.fn()
      );

      await expect(manager.forceRefresh()).rejects.toThrow(RefreshFailedError);
      manager.destroy();
    });

    it('rejects with NetworkError when the server returns a non-string refreshToken', async () => {
      const storage = new MemoryStorageAdapter();
      storage.set('tk_refresh', 'rt');
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: vi
            .fn()
            .mockResolvedValue({ accessToken: 'at', refreshToken: 999 }),
        })
      );
      const manager = new RefreshManager(
        { endpoint: '/api/refresh', maxRetries: 0 },
        storage,
        vi.fn(),
        vi.fn()
      );

      await expect(manager.forceRefresh()).rejects.toMatchObject({
        code: 'REFRESH_FAILED',
        message: 'Invalid refresh response: refreshToken must be a string',
      });
      manager.destroy();
    });

    it('rejects immediately without retrying when the endpoint returns 401', async () => {
      const storage = new MemoryStorageAdapter();
      storage.set('tk_refresh', 'rt');
      const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 });
      vi.stubGlobal('fetch', fetchMock);
      const onFailure = vi.fn();
      const manager = new RefreshManager(
        { endpoint: '/api/refresh', maxRetries: 3 },
        storage,
        vi.fn(),
        onFailure
      );

      await expect(manager.forceRefresh()).rejects.toThrow(RefreshFailedError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(onFailure).toHaveBeenCalledTimes(1);
      manager.destroy();
    });
  });

  describe('forceRefresh — error guards', () => {
    it('throws RefreshFailedError immediately with attempts 0 when no refresh token is stored', async () => {
      const storage = new MemoryStorageAdapter();
      const manager = new RefreshManager(
        { endpoint: '/api/refresh' },
        storage,
        vi.fn(),
        vi.fn()
      );

      await expect(manager.forceRefresh()).rejects.toMatchObject({
        code: 'REFRESH_FAILED',
        attempts: 0,
      });
      manager.destroy();
    });

    it('throws RefreshFailedError immediately with attempts 0 when neither endpoint nor handler is configured', async () => {
      const storage = new MemoryStorageAdapter();
      storage.set('tk_refresh', 'rt');
      const manager = new RefreshManager({}, storage, vi.fn(), vi.fn());

      await expect(manager.forceRefresh()).rejects.toMatchObject({
        code: 'REFRESH_FAILED',
        attempts: 0,
      });
      manager.destroy();
    });
  });

  describe('forceRefresh — retry and backoff', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.spyOn(Math, 'random').mockReturnValue(0);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('retries with delays of 1s, 2s, then 4s before succeeding on the final attempt', async () => {
      const storage = new MemoryStorageAdapter();
      storage.set('tk_refresh', 'rt');
      const handler = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce({ accessToken: 'final-at' });
      const onRefresh = vi.fn();
      const manager = new RefreshManager(
        { handler, maxRetries: 3, retryDelay: 1000 },
        storage,
        onRefresh,
        vi.fn()
      );

      const promise = manager.forceRefresh();
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);
      const result = await promise;

      expect(handler).toHaveBeenCalledTimes(4);
      expect(result.accessToken).toBe('final-at');
      expect(onRefresh).toHaveBeenCalledTimes(1);
      manager.destroy();
    });

    it('calls onFailure and throws RefreshFailedError after all retries are exhausted', async () => {
      const storage = new MemoryStorageAdapter();
      storage.set('tk_refresh', 'rt');
      const handler = vi.fn().mockRejectedValue(new Error('always fails'));
      const onRefresh = vi.fn();
      const onFailure = vi.fn();
      const manager = new RefreshManager(
        { handler, maxRetries: 2, retryDelay: 500 },
        storage,
        onRefresh,
        onFailure
      );

      const promise = manager.forceRefresh();
      promise.catch(() => {});

      await vi.advanceTimersByTimeAsync(500);
      await vi.advanceTimersByTimeAsync(1000);

      await expect(promise).rejects.toMatchObject({
        code: 'REFRESH_FAILED',
        attempts: 3,
      });
      expect(onFailure).toHaveBeenCalledTimes(1);
      expect(onFailure).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'REFRESH_FAILED', attempts: 3 })
      );
      expect(onRefresh).not.toHaveBeenCalled();
      manager.destroy();
    });

    it('sleep duration includes jitter of up to 50% of the retry delay', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(1.0);
      const storage = new MemoryStorageAdapter();
      storage.set('tk_refresh', 'rt');
      const handler = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce({ accessToken: 'at' });
      const manager = new RefreshManager(
        { handler, maxRetries: 1, retryDelay: 1000 },
        storage,
        vi.fn(),
        vi.fn()
      );

      const promise = manager.forceRefresh();
      await vi.advanceTimersByTimeAsync(1499);
      expect(handler).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      const result = await promise;
      expect(handler).toHaveBeenCalledTimes(2);
      expect(result.accessToken).toBe('at');
      manager.destroy();
    });
  });

  describe('scheduleRefresh', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('fires forceRefresh after the configured buffer elapses before token expiry', async () => {
      const storage = new MemoryStorageAdapter();
      storage.set('tk_refresh', 'rt');
      const handler = vi.fn().mockResolvedValueOnce({ accessToken: 'new-at' });
      const onRefresh = vi.fn();
      const manager = new RefreshManager(
        { handler, buffer: 60 },
        storage,
        onRefresh,
        vi.fn()
      );

      manager.scheduleRefresh(createTestJwt({}, 120));

      await vi.advanceTimersByTimeAsync(59_999);
      expect(onRefresh).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      expect(onRefresh).toHaveBeenCalledTimes(1);
      manager.destroy();
    });

    it('skips scheduling for tokens that have no exp claim', () => {
      const storage = new MemoryStorageAdapter();
      storage.set('tk_refresh', 'rt');
      const onRefresh = vi.fn();
      const manager = new RefreshManager(
        { handler: vi.fn() },
        storage,
        onRefresh,
        vi.fn()
      );

      manager.scheduleRefresh(makeJwtNoExp());

      vi.advanceTimersByTime(Number.MAX_SAFE_INTEGER);
      expect(onRefresh).not.toHaveBeenCalled();
      manager.destroy();
    });

    it('cancels the previous timer when scheduleRefresh is called again before it fires', async () => {
      const storage = new MemoryStorageAdapter();
      storage.set('tk_refresh', 'rt');
      const handler = vi
        .fn()
        .mockResolvedValueOnce({ accessToken: 'second-at' });
      const onRefresh = vi.fn();
      const manager = new RefreshManager(
        { handler, buffer: 0 },
        storage,
        onRefresh,
        vi.fn()
      );

      manager.scheduleRefresh(createTestJwt({}, 60));
      manager.scheduleRefresh(createTestJwt({}, 90));

      await vi.advanceTimersByTimeAsync(60_001);
      expect(onRefresh).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(30_000);
      expect(onRefresh).toHaveBeenCalledTimes(1);
      manager.destroy();
    });

    it('cancelSchedule prevents the scheduled timer from firing', async () => {
      const storage = new MemoryStorageAdapter();
      storage.set('tk_refresh', 'rt');
      const onRefresh = vi.fn();
      const manager = new RefreshManager(
        {
          handler: vi.fn().mockResolvedValueOnce({ accessToken: 'new' }),
          buffer: 0,
        },
        storage,
        onRefresh,
        vi.fn()
      );

      manager.scheduleRefresh(createTestJwt({}, 60));
      manager.cancelSchedule();

      await vi.advanceTimersByTimeAsync(120_000);
      expect(onRefresh).not.toHaveBeenCalled();
      manager.destroy();
    });
  });

  describe('destroy', () => {
    it('rejects forceRefresh when destroy is called while waiting for the online event', async () => {
      const storage = new MemoryStorageAdapter();
      storage.set('tk_refresh', 'rt');
      vi.stubGlobal('navigator', { onLine: false });
      const manager = new RefreshManager(
        { handler: vi.fn() },
        storage,
        vi.fn(),
        vi.fn()
      );

      const promise = manager.forceRefresh();
      manager.destroy();

      await expect(promise).rejects.toThrow(RefreshFailedError);
    });

    it('aborts in-flight fetch and does not call onRefresh when destroy is called during executeRefresh', async () => {
      const storage = new MemoryStorageAdapter();
      storage.set('tk_refresh', 'rt');
      const fetchMock = vi
        .fn()
        .mockImplementation((_url: string, options: RequestInit) => {
          return new Promise((_resolve, reject) => {
            options.signal?.addEventListener('abort', () => {
              reject(
                new DOMException('The operation was aborted.', 'AbortError')
              );
            });
          });
        });
      vi.stubGlobal('fetch', fetchMock);
      const onRefresh = vi.fn();
      const manager = new RefreshManager(
        { endpoint: '/api/refresh', maxRetries: 0 },
        storage,
        onRefresh,
        vi.fn()
      );

      const promise = manager.forceRefresh();
      promise.catch(() => {});
      manager.destroy();

      await expect(promise).rejects.toThrow();
      expect(onRefresh).not.toHaveBeenCalled();
    });

    it('cancels a pending scheduled timer so the refresh never fires', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
      const storage = new MemoryStorageAdapter();
      storage.set('tk_refresh', 'rt');
      const onRefresh = vi.fn();
      const manager = new RefreshManager(
        {
          handler: vi.fn().mockResolvedValueOnce({ accessToken: 'new' }),
          buffer: 0,
        },
        storage,
        onRefresh,
        vi.fn()
      );

      manager.scheduleRefresh(createTestJwt({}, 60));
      manager.destroy();

      await vi.advanceTimersByTimeAsync(120_000);
      expect(onRefresh).not.toHaveBeenCalled();
      vi.useRealTimers();
    });
  });
});
