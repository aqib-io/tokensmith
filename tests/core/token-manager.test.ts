import { createTokenManager } from "@/core";
import { RefreshFailedError } from "@/core/errors";
import { MemoryStorageAdapter } from "@/core/storage/memory";
import { createTestJwt } from "../helpers/create-test-jwt";
import type { TokenPair } from "@/core/types";

describe("TokenManager", () => {
  describe("full lifecycle", () => {
    it("isAuthenticated returns false before tokens are set", () => {
      const auth = createTokenManager({ storage: "memory" });
      expect(auth.isAuthenticated()).toBe(false);
      auth.destroy();
    });

    it("isAuthenticated returns true after setTokens with a valid token", () => {
      const auth = createTokenManager({ storage: "memory" });
      auth.setTokens({ accessToken: createTestJwt() });
      expect(auth.isAuthenticated()).toBe(true);
      auth.destroy();
    });

    it("getUser returns the decoded JWT payload after setTokens", () => {
      const auth = createTokenManager({ storage: "memory" });
      auth.setTokens({
        accessToken: createTestJwt({ sub: "user-1", email: "test@test.com" }),
      });
      const user = auth.getUser();
      expect(user).not.toBeNull();
      expect(user?.sub).toBe("user-1");
      expect(user?.email).toBe("test@test.com");
      auth.destroy();
    });

    it("getState reflects authenticated state after setTokens", () => {
      const auth = createTokenManager({ storage: "memory" });
      const token = createTestJwt();
      auth.setTokens({ accessToken: token });
      const state = auth.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.accessToken).toBe(token);
      expect(state.user).not.toBeNull();
      expect(state.isRefreshing).toBe(false);
      expect(state.error).toBeNull();
      auth.destroy();
    });

    it("getState returns the same object reference when state has not changed", () => {
      const auth = createTokenManager({ storage: "memory" });
      auth.setTokens({ accessToken: createTestJwt() });
      const s1 = auth.getState();
      const s2 = auth.getState();
      expect(s1).toBe(s2);
      auth.destroy();
    });

    it("getAccessToken returns the access token when authenticated", async () => {
      const auth = createTokenManager({ storage: "memory" });
      const token = createTestJwt();
      auth.setTokens({ accessToken: token });
      expect(await auth.getAccessToken()).toBe(token);
      auth.destroy();
    });

    it("getAccessToken returns null when not authenticated", async () => {
      const auth = createTokenManager({ storage: "memory" });
      expect(await auth.getAccessToken()).toBeNull();
      auth.destroy();
    });

    it("isAuthenticated returns false after logout", () => {
      const auth = createTokenManager({ storage: "memory" });
      auth.setTokens({ accessToken: createTestJwt() });
      auth.logout();
      expect(auth.isAuthenticated()).toBe(false);
      auth.destroy();
    });

    it("getUser returns null after logout", () => {
      const auth = createTokenManager({ storage: "memory" });
      auth.setTokens({ accessToken: createTestJwt() });
      auth.logout();
      expect(auth.getUser()).toBeNull();
      auth.destroy();
    });

    it("getState reflects unauthenticated state after logout", () => {
      const auth = createTokenManager({ storage: "memory" });
      auth.setTokens({ accessToken: createTestJwt() });
      auth.logout();
      const state = auth.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.accessToken).toBeNull();
      expect(state.user).toBeNull();
      auth.destroy();
    });
  });

  describe("auto-refresh on expired token", () => {
    it("getAccessToken triggers refresh when access token is expired", async () => {
      const newToken = createTestJwt({}, 3600);
      const handler = vi.fn().mockResolvedValueOnce({ accessToken: newToken });
      const storage = new MemoryStorageAdapter();
      storage.set("tk_access", createTestJwt({}, -1));
      storage.set("tk_refresh", "stored-rt");
      const auth = createTokenManager({ storage, refresh: { handler } });

      const result = await auth.getAccessToken();

      expect(handler).toHaveBeenCalledWith("stored-rt");
      expect(result).toBe(newToken);
      auth.destroy();
    });

    it("getAccessToken returns null when token is expired and no refresh is configured", async () => {
      const storage = new MemoryStorageAdapter();
      storage.set("tk_access", createTestJwt({}, -1));
      const auth = createTokenManager({ storage });

      expect(await auth.getAccessToken()).toBeNull();
      auth.destroy();
    });

    it("getAccessToken rejects with RefreshFailedError when token is expired and refresh fails", async () => {
      const storage = new MemoryStorageAdapter();
      storage.set("tk_access", createTestJwt({}, -1));
      // no tk_refresh stored — forceRefresh will throw immediately
      const auth = createTokenManager({
        storage,
        refresh: { endpoint: "/api/refresh" },
      });

      await expect(auth.getAccessToken()).rejects.toThrow(RefreshFailedError);
      auth.destroy();
    });
  });

  describe("onAuthChange notifications", () => {
    it("listener is called with authenticated state when setTokens is called", () => {
      const auth = createTokenManager({ storage: "memory" });
      const listener = vi.fn();
      auth.onAuthChange(listener);
      auth.setTokens({ accessToken: createTestJwt() });
      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ isAuthenticated: true }),
      );
      auth.destroy();
    });

    it("listener is called with unauthenticated state when logout is called", () => {
      const auth = createTokenManager({ storage: "memory" });
      auth.setTokens({ accessToken: createTestJwt() });
      const listener = vi.fn();
      auth.onAuthChange(listener);
      auth.logout();
      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ isAuthenticated: false, user: null }),
      );
      auth.destroy();
    });

    it("unsubscribe prevents the listener from receiving further notifications", () => {
      const auth = createTokenManager({ storage: "memory" });
      const listener = vi.fn();
      const unsubscribe = auth.onAuthChange(listener);
      unsubscribe();
      auth.setTokens({ accessToken: createTestJwt() });
      expect(listener).not.toHaveBeenCalled();
      auth.destroy();
    });

    it("multiple listeners all receive state change notifications", () => {
      const auth = createTokenManager({ storage: "memory" });
      const l1 = vi.fn();
      const l2 = vi.fn();
      auth.onAuthChange(l1);
      auth.onAuthChange(l2);
      auth.setTokens({ accessToken: createTestJwt() });
      expect(l1).toHaveBeenCalledOnce();
      expect(l2).toHaveBeenCalledOnce();
      auth.destroy();
    });
  });

  describe("getAccessToken — concurrent refresh deduplication", () => {
    it("concurrent calls while refresh is in progress all resolve to the same token", async () => {
      const newToken = createTestJwt({}, 3600);
      let resolveHandler!: (tokens: TokenPair) => void;
      const controlled = new Promise<TokenPair>((r) => {
        resolveHandler = r;
      });
      const handler = vi.fn(() => controlled);
      const storage = new MemoryStorageAdapter();
      storage.set("tk_access", createTestJwt({}, -1));
      storage.set("tk_refresh", "rt");
      const auth = createTokenManager({ storage, refresh: { handler } });

      const p1 = auth.getAccessToken();
      const p2 = auth.getAccessToken();
      const p3 = auth.getAccessToken();
      resolveHandler({ accessToken: newToken });

      const [t1, t2, t3] = await Promise.all([p1, p2, p3]);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(t1).toBe(newToken);
      expect(t2).toBe(newToken);
      expect(t3).toBe(newToken);
      auth.destroy();
    });
  });

  describe("fromCookieHeader", () => {
    it("returns a TokenPair parsed from a cookie header string when using cookie storage", () => {
      const auth = createTokenManager({ storage: "cookie" });
      const jwt = createTestJwt();
      const result = auth.fromCookieHeader(
        `tk_access=${jwt}; tk_refresh=my-refresh-token`,
      );
      expect(result).not.toBeNull();
      expect(result?.accessToken).toBe(jwt);
      expect(result?.refreshToken).toBe("my-refresh-token");
      auth.destroy();
    });

    it("returns null when not using cookie storage", () => {
      const auth = createTokenManager({ storage: "memory" });
      expect(auth.fromCookieHeader("tk_access=some-token")).toBeNull();
      auth.destroy();
    });
  });

  describe("destroy", () => {
    it("clears all listeners so state changes no longer notify them", () => {
      const auth = createTokenManager({ storage: "memory" });
      const listener = vi.fn();
      auth.onAuthChange(listener);
      auth.destroy();
      auth.setTokens({ accessToken: createTestJwt() });
      expect(listener).not.toHaveBeenCalled();
    });

    it("can be called on an instance with no refresh or sync managers without throwing", () => {
      const auth = createTokenManager({ storage: "memory" });
      expect(() => auth.destroy()).not.toThrow();
    });
  });

  describe("default config", () => {
    it("creates a functioning manager with no configuration supplied", () => {
      const auth = createTokenManager();
      const token = createTestJwt();
      auth.setTokens({ accessToken: token });
      expect(auth.isAuthenticated()).toBe(true);
      expect(auth.getUser()).not.toBeNull();
      auth.destroy();
    });
  });

  describe("createAuthFetch", () => {
    it("attaches a Bearer Authorization header to requests when authenticated", async () => {
      const auth = createTokenManager({ storage: "memory" });
      const token = createTestJwt();
      auth.setTokens({ accessToken: token });

      let capturedInit: RequestInit | undefined;
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(
          (_url: RequestInfo | URL, init?: RequestInit) => {
            capturedInit = init;
            return Promise.resolve({ status: 200, ok: true });
          },
        ),
      );

      await auth.createAuthFetch()("/api/data");

      expect(
        (capturedInit?.headers as Headers | undefined)?.get("Authorization"),
      ).toBe(`Bearer ${token}`);
      auth.destroy();
    });

    it("does not attach an Authorization header when not authenticated", async () => {
      const auth = createTokenManager({ storage: "memory" });

      let capturedInit: RequestInit | undefined;
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(
          (_url: RequestInfo | URL, init?: RequestInit) => {
            capturedInit = init;
            return Promise.resolve({ status: 401, ok: false });
          },
        ),
      );

      await auth.createAuthFetch()("/api/data");

      expect(
        (capturedInit?.headers as Headers | undefined)?.get("Authorization"),
      ).toBeNull();
      auth.destroy();
    });

    it("replays the request with the new token after a 401 and successful refresh", async () => {
      const newToken = createTestJwt({}, 3600);
      const handler = vi.fn().mockResolvedValueOnce({ accessToken: newToken });
      const storage = new MemoryStorageAdapter();
      storage.set("tk_access", createTestJwt({}, 3600));
      storage.set("tk_refresh", "rt");
      const auth = createTokenManager({ storage, refresh: { handler } });

      const response401 = { status: 401, ok: false };
      const response200 = { status: 200, ok: true };
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(response401)
        .mockResolvedValueOnce(response200);
      vi.stubGlobal("fetch", fetchMock);

      const result = await auth.createAuthFetch()("/api/data");

      expect(result.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledTimes(1);
      auth.destroy();
    });

    it("returns the original 401 response when the refresh fails", async () => {
      const storage = new MemoryStorageAdapter();
      storage.set("tk_access", createTestJwt({}, 3600));
      const auth = createTokenManager({
        storage,
        refresh: { endpoint: "/api/refresh" },
      });

      const fetchMock = vi.fn().mockResolvedValue({ status: 401, ok: false });
      vi.stubGlobal("fetch", fetchMock);

      const result = await auth.createAuthFetch()("/api/data");

      expect(result.status).toBe(401);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      auth.destroy();
    });

    it("returns the original 401 response when no refresh manager is configured", async () => {
      const auth = createTokenManager({ storage: "memory" });
      auth.setTokens({ accessToken: createTestJwt() });

      const fetchMock = vi.fn().mockResolvedValue({ status: 401, ok: false });
      vi.stubGlobal("fetch", fetchMock);

      const result = await auth.createAuthFetch()("/api/data");

      expect(result.status).toBe(401);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      auth.destroy();
    });

    it("does not retry on non-401 error responses", async () => {
      const handler = vi.fn();
      const auth = createTokenManager({
        storage: "memory",
        refresh: { handler },
      });
      auth.setTokens({ accessToken: createTestJwt(), refreshToken: "rt" });

      const fetchMock = vi.fn().mockResolvedValue({ status: 500, ok: false });
      vi.stubGlobal("fetch", fetchMock);

      const result = await auth.createAuthFetch()("/api/data");

      expect(result.status).toBe(500);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(handler).not.toHaveBeenCalled();
      auth.destroy();
    });
  });

  describe("timer-based auto-refresh", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("getState().isRefreshing is false after a timer-triggered refresh succeeds", async () => {
      const newToken = createTestJwt({}, 3600);
      const handler = vi.fn().mockResolvedValueOnce({ accessToken: newToken });
      const storage = new MemoryStorageAdapter();
      const auth = createTokenManager({
        storage,
        refresh: { handler, buffer: 60 },
      });

      auth.setTokens({ accessToken: createTestJwt({}, 120), refreshToken: "rt" });

      await vi.advanceTimersByTimeAsync(60_000);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(auth.getState().isRefreshing).toBe(false);
      auth.destroy();
    });

    it("getState().isRefreshing is false after a timer-triggered refresh fails", async () => {
      const handler = vi.fn().mockRejectedValue(new Error("refresh failed"));
      const storage = new MemoryStorageAdapter();
      const auth = createTokenManager({
        storage,
        refresh: { handler, buffer: 60, maxRetries: 0 },
      });

      auth.setTokens({ accessToken: createTestJwt({}, 120), refreshToken: "rt" });

      await vi.advanceTimersByTimeAsync(60_000);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(auth.getState().isRefreshing).toBe(false);
      auth.destroy();
    });

    it("schedules a refresh timer for a pre-existing valid token at construction", async () => {
      const newToken = createTestJwt({}, 3600);
      const handler = vi.fn().mockResolvedValueOnce({ accessToken: newToken });
      const storage = new MemoryStorageAdapter();
      storage.set("tk_access", createTestJwt({}, 120));
      storage.set("tk_refresh", "rt");
      const auth = createTokenManager({
        storage,
        refresh: { handler, buffer: 60 },
      });

      await vi.advanceTimersByTimeAsync(60_000);

      expect(handler).toHaveBeenCalledTimes(1);
      auth.destroy();
    });

    it("schedules a refresh timer on instance B after it receives TOKEN_SET from instance A sharing storage", async () => {
      const sharedStorage = new MemoryStorageAdapter();
      const newToken = createTestJwt({}, 3600);
      const handlerB = vi.fn().mockResolvedValue({ accessToken: newToken });

      const authA = createTokenManager({ storage: sharedStorage });
      const authB = createTokenManager({
        storage: sharedStorage,
        refresh: { handler: handlerB, buffer: 60 },
      });

      authA.setTokens({ accessToken: createTestJwt({}, 120), refreshToken: "rt" });

      await vi.advanceTimersByTimeAsync(60_000);

      expect(handlerB).toHaveBeenCalledTimes(1);
      authA.destroy();
      authB.destroy();
    });
  });

  describe("visibilitychange refresh", () => {
    it("triggers refresh when tab becomes visible with an expired access token", async () => {
      const newToken = createTestJwt({}, 3600);
      const handler = vi.fn().mockResolvedValueOnce({ accessToken: newToken });
      const storage = new MemoryStorageAdapter();
      storage.set("tk_access", createTestJwt({}, -1));
      storage.set("tk_refresh", "rt");
      const auth = createTokenManager({ storage, refresh: { handler } });

      document.dispatchEvent(new Event("visibilitychange"));

      await vi.waitFor(() => {
        expect(storage.get("tk_access")).toBe(newToken);
      });
      expect(handler).toHaveBeenCalledTimes(1);
      auth.destroy();
    });
  });

  describe("updateState shallow equality", () => {
    it("does not notify listeners when logout is called on an already-unauthenticated manager", () => {
      const auth = createTokenManager({ storage: "memory" });
      const listener = vi.fn();
      auth.onAuthChange(listener);
      auth.logout();
      expect(listener).not.toHaveBeenCalled();
      auth.destroy();
    });

    it("does not notify listeners on the second logout when state is already unauthenticated", () => {
      const auth = createTokenManager({ storage: "memory" });
      auth.setTokens({ accessToken: createTestJwt() });
      const listener = vi.fn();
      auth.onAuthChange(listener);
      auth.logout();
      expect(listener).toHaveBeenCalledOnce();
      listener.mockClear();
      auth.logout();
      expect(listener).not.toHaveBeenCalled();
      auth.destroy();
    });
  });

  describe("onAuthFailure callback", () => {
    it("calls onAuthFailure when all refresh retries are exhausted", async () => {
      const onAuthFailure = vi.fn();
      const handler = vi.fn().mockRejectedValue(new Error("always fails"));
      const storage = new MemoryStorageAdapter();
      storage.set("tk_access", createTestJwt({}, -1));
      storage.set("tk_refresh", "rt");
      const auth = createTokenManager({
        storage,
        refresh: { handler, maxRetries: 0, retryDelay: 0 },
        onAuthFailure,
      });

      await auth.getAccessToken().catch(() => {});

      expect(onAuthFailure).toHaveBeenCalledOnce();
      auth.destroy();
    });

    it("getState reflects unauthenticated state with error set after refresh fails when token is expired", async () => {
      const onAuthFailure = vi.fn();
      const handler = vi.fn().mockRejectedValue(new Error("always fails"));
      const storage = new MemoryStorageAdapter();
      storage.set("tk_access", createTestJwt({}, -1));
      storage.set("tk_refresh", "rt");
      const auth = createTokenManager({
        storage,
        refresh: { handler, maxRetries: 0 },
        onAuthFailure,
      });

      await auth.getAccessToken().catch(() => {});

      expect(onAuthFailure).toHaveBeenCalledOnce();
      expect(auth.getState().isAuthenticated).toBe(false);
      expect(auth.getState().accessToken).toBeNull();
      expect(auth.getState().error).toBeInstanceOf(RefreshFailedError);
      auth.destroy();
    });

    it("calls onAuthFailure when no refresh token is stored", async () => {
      const onAuthFailure = vi.fn();
      const storage = new MemoryStorageAdapter();
      storage.set("tk_access", createTestJwt({}, -1));
      const auth = createTokenManager({
        storage,
        refresh: { endpoint: "/api/refresh" },
        onAuthFailure,
      });

      await auth.getAccessToken().catch(() => {});

      expect(onAuthFailure).toHaveBeenCalledOnce();
      auth.destroy();
    });
  });
});
