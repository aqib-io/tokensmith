import { createTokenManager } from "@/core";
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
  });
});
