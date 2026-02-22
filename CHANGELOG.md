# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-02-22

### Added

- `createTokenManager<TUser>(config?)` factory — framework-agnostic JWT token manager with generic user payload typing.
- `TokenManager<TUser>` interface with `setTokens`, `getAccessToken`, `getUser`, `isAuthenticated`, `getState`, `onAuthChange`, `logout`, `getAuthHeader`, `createAuthFetch`, `fromCookieHeader`, and `destroy`.
- `AuthState<TUser>` reactive state shape (`isAuthenticated`, `user`, `accessToken`, `isRefreshing`, `error`).
- **Cookie storage** (default) — `document.cookie` with `SameSite=Strict; Secure` defaults; `maxAge: 'auto'` derives expiry from JWT `exp` claim.
- **Memory storage** — `Map`-backed in-process store; zero persistence, zero XSS exposure.
- **localStorage storage** — `window.localStorage` with `tk_` key prefix.
- **Custom `StorageAdapter` interface** — `get / set / remove / clear`; pass any object implementing this interface to `createTokenManager`.
- **Auto-refresh engine** — timer-based pre-emptive refresh (configurable buffer, default 60 s before expiry), on-demand refresh via `getAccessToken()`, `PromiseQueue` deduplication (concurrent callers share one request), exponential backoff retry, refresh token rotation.
- **Offline awareness** — refresh retries are deferred until the `online` event fires when `navigator.onLine` is `false`; does not burn retry attempts while the device is offline.
- **Cross-tab synchronization** — `BroadcastChannel`-based sync; automatic `localStorage` `storage` event fallback in environments without `BroadcastChannel`; SSR-safe.
- **`createAuthFetch()`** — fetch wrapper that auto-attaches `Authorization: Bearer <token>`; retries once on 401.
- **`getAuthHeader()`** — returns `{ Authorization: string }` or `{}` for use with Axios interceptors and similar.
- **`fromCookieHeader(header)`** — parses a raw `Cookie:` request header and returns a `TokenPair`; for SSR use with cookie storage.
- **React adapter** (`tokensmith/react`) — `TokenProvider`, `useAuth<TUser>()`, `useTokenManager<TUser>()`; backed by `useSyncExternalStore` for concurrent-mode safety and no tearing.
- **Typed error classes** — `TokenSmithError` (base), `InvalidTokenError`, `TokenExpiredError`, `RefreshFailedError` (with `attempts` count), `StorageError`, `NetworkError`.
- **`onAuthFailure` callback** — invoked once when all refresh retries are exhausted.
- Dual ESM + CommonJS output; full TypeScript declaration files; zero runtime dependencies.
- 117 unit and integration tests.

[Unreleased]: https://github.com/aqib-io/tokensmith/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/aqib-io/tokensmith/releases/tag/v0.1.0
