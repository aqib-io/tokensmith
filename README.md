<p align="center">
  <img src="./assets/banner.svg" alt="TokenSmith — Framework-agnostic JWT token management" />
</p>

> You handle authentication. We handle the tokens after.

[![npm](https://img.shields.io/npm/v/tokensmith)](https://www.npmjs.com/package/tokensmith)
[![CI](https://github.com/aqib-io/tokensmith/actions/workflows/ci.yml/badge.svg)](https://github.com/aqib-io/tokensmith/actions/workflows/ci.yml)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/tokensmith)](https://bundlephobia.com/package/tokensmith)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue)](https://www.typescriptlang.org/)

Every app using JWTs ends up writing the same client-side logic: store tokens securely, refresh them before expiry, deduplicate concurrent refresh calls, keep browser tabs in sync, update the UI reactively. TokenSmith handles all of it — framework-agnostic, zero dependencies.

---

## Table of Contents

- [Why TokenSmith](#why-tokensmith)
- [Install](#install)
- [What TokenSmith replaces](#what-tokensmith-replaces)
- [Quick Start](#quick-start)
- [React](#react)
- [Core API](#core-api)
- [React API](#react-api)
- [Configuration](#configuration)
- [Storage Backends](#storage-backends)
- [Cross-Tab Sync](#cross-tab-sync)
- [Auto-Refresh](#auto-refresh)
- [SSR Support](#ssr-support)
- [TypeScript](#typescript)
- [Errors](#errors)
- [Security](#security)
- [Compatibility](#compatibility)
- [Bundle Size](#bundle-size)
- [Examples](#examples)
- [Changelog](#changelog)
- [Contributing](#contributing)
- [License](#license)

## Why TokenSmith

- **Zero boilerplate** — one `createTokenManager()` call replaces hundreds of lines of manual token handling written fresh for every project
- **Auto-refresh that just works** — tokens refresh before expiry; concurrent callers share one request, no matter how many
- **Cross-tab sync** — logout in one tab logs out all tabs instantly via `BroadcastChannel`, with automatic `localStorage` fallback
- **React-ready** — `useSyncExternalStore`-backed `useAuth()` hook; concurrent-mode safe, no extra renders, no tearing
- **Zero dependencies** — no supply chain risk; tree-shakeable ESM + CJS; cookie storage with `SameSite=Strict; Secure` by default; ~5 KB gzipped

## Install

```bash
npm install tokensmith
```

The React adapter ships in the same package — no separate install needed.

## What TokenSmith replaces

Without TokenSmith, every project ships some version of this:

```ts
let refreshPromise: Promise<string> | null = null;

async function getValidToken(): Promise<string | null> {
  const token = localStorage.getItem('access_token');
  if (token && !isExpired(token)) return token;

  if (!refreshPromise) {
    refreshPromise = fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: localStorage.getItem('refresh_token') }),
    })
      .then((r) => r.json())
      .then((data) => {
        localStorage.setItem('access_token', data.accessToken);
        localStorage.setItem('refresh_token', data.refreshToken);
        refreshPromise = null;
        return data.accessToken;
      });
  }
  return refreshPromise;
}
```

With TokenSmith:

```ts
const auth = createTokenManager({ refresh: { endpoint: '/api/auth/refresh' } });
const token = await auth.getAccessToken(); // auto-refreshes, deduplicates, retries with backoff
```

Plus: cross-tab sync, React hooks, typed errors, SSR support, and offline-awareness — all included.

## Quick Start

```ts
import { createTokenManager } from 'tokensmith';

const auth = createTokenManager({
  refresh: { endpoint: '/api/auth/refresh' },
});

// After login — store the token pair
auth.setTokens({ accessToken: '...', refreshToken: '...' });

// Get a valid token (auto-refreshes if expired)
const token = await auth.getAccessToken();

// Or use the built-in fetch wrapper
const authFetch = auth.createAuthFetch();
const res = await authFetch('/api/data'); // Authorization: Bearer <token> attached automatically
```

## React

```tsx
import { createTokenManager } from 'tokensmith';
import { TokenProvider, useAuth } from 'tokensmith/react';

// Create once at module scope — not inside a component
const auth = createTokenManager({
  refresh: { endpoint: '/api/auth/refresh' },
});

function App() {
  return (
    <TokenProvider manager={auth}>
      <Dashboard />
    </TokenProvider>
  );
}

function Dashboard() {
  const { isAuthenticated, user, logout } = useAuth();

  if (!isAuthenticated) return <Login />;

  return (
    <div>
      <p>Welcome, {user.email}</p>
      <button onClick={logout}>Sign out</button>
    </div>
  );
}
```

### Protected routes

```tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from 'tokensmith/react';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}
```

## Core API

`createTokenManager<TUser>(config?)` returns a `TokenManager<TUser>`:

| Method | Returns | Description |
|--------|---------|-------------|
| `setTokens(tokens)` | `void` | Store access + optional refresh token after login |
| `getAccessToken()` | `Promise<string \| null>` | Get a valid token; auto-refreshes if expired |
| `getUser()` | `TUser \| null` | Decoded JWT payload; `null` if expired or unauthenticated |
| `isAuthenticated()` | `boolean` | `true` when a non-expired access token is stored |
| `getState()` | `AuthState<TUser>` | Current auth state snapshot |
| `onAuthChange(listener)` | `() => void` | Subscribe to state changes; returns unsubscribe function |
| `logout()` | `void` | Clear all tokens, cancel refresh timer, notify listeners |
| `getAuthHeader()` | `Promise<{ Authorization: string } \| {}>` | Bearer header for axios interceptors and similar |
| `createAuthFetch()` | `typeof fetch` | Fetch wrapper: auto-attaches `Authorization`, retries once on 401 |
| `fromCookieHeader(header)` | `TokenPair \| null` | Extract tokens from a raw `Cookie:` header string (SSR; works with any storage backend) |
| `destroy()` | `void` | Cancel timers, close channels, clear all listeners |

### `TokenPair`

```ts
interface TokenPair {
  accessToken: string;
  refreshToken?: string; // optional — omit if your backend only issues access tokens
}
```

### `AuthState<TUser>`

```ts
interface AuthState<TUser = Record<string, unknown>> {
  isAuthenticated: boolean;
  user: TUser | null;
  accessToken: string | null;
  isRefreshing: boolean;
  error: TokenSmithError | null;
}
```

`error` is set when a refresh fails and cleared on the next successful state transition (e.g. `setTokens`, `logout`). To handle auth failures durably, use the `onAuthFailure` callback in your config.

### Subscribing to changes

`onAuthChange` registers a listener that fires on every auth state transition. It returns an unsubscribe function.

```ts
const unsubscribe = auth.onAuthChange((state) => {
  console.log('authenticated:', state.isAuthenticated);
  console.log('user:', state.user);

  if (state.error) {
    console.error('auth error:', state.error.code);
  }
});

// Remove the listener when no longer needed
unsubscribe();
```

### Axios interceptors

Use `getAuthHeader()` to attach a Bearer token to every Axios request:

```ts
import axios from 'axios';

const client = axios.create({ baseURL: '/api' });

client.interceptors.request.use(async (config) => {
  const header = await auth.getAuthHeader(); // {} when unauthenticated
  Object.assign(config.headers, header);
  return config;
});
```

### Cleanup

Call `destroy()` when the manager is no longer needed to cancel background timers, close the `BroadcastChannel`, and clear all listeners:

```ts
// In a Vite app with hot module replacement
if (import.meta.hot) {
  import.meta.hot.dispose(() => auth.destroy());
}

// In a framework with a teardown lifecycle
onUnmount(() => auth.destroy());
```

## React API

### `<TokenProvider manager={auth}>`

Provides the `TokenManager` to the component tree. Pass the manager as a prop — TokenSmith never creates it internally, so manager creation stays outside React's lifecycle.

```tsx
interface TokenProviderProps {
  manager: TokenManager;
  children: ReactNode;
}
```

### `useAuth<TUser>()`

```ts
const {
  isAuthenticated, // boolean
  user,            // TUser | null
  accessToken,     // string | null
  isRefreshing,    // boolean — true during an active token refresh
  error,           // TokenSmithError | null — set when all refresh retries fail
  getAccessToken,  // () => Promise<string | null>
  logout,          // () => void
} = useAuth<UserPayload>();
```

Backed by `useSyncExternalStore` — concurrent-mode safe, no tearing, no extra renders.

### `useTokenManager<TUser>()`

Returns the raw `TokenManager` instance from context. Use this to build custom hooks on top of TokenSmith.

```ts
const manager = useTokenManager();
const authFetch = manager.createAuthFetch();
```

## Configuration

`createTokenManager(config?)` accepts a `TokenManagerConfig` object with the following options:

```ts
const auth = createTokenManager({
  // Storage backend: 'cookie' (default), 'memory', 'localStorage', or a custom StorageAdapter
  storage: 'cookie',

  // Cookie-specific options (only applies when storage is 'cookie')
  cookie: {
    path: '/',
    domain: '.example.com',
    sameSite: 'strict',        // 'strict' | 'lax' | 'none'
    secure: true,              // auto-detected from location.protocol when omitted
    maxAge: 'auto',            // derives expiry from JWT exp claim; omit for session cookie
  },

  // Auto-refresh configuration
  refresh: {
    endpoint: '/api/auth/refresh', // URL — sends POST with { refreshToken } body
    handler: async (rt) => {},     // or a custom async handler (use one, not both)
    buffer: 60,                    // seconds before expiry to refresh (default: 60)
    maxRetries: 3,                 // retry attempts on transient failure (default: 3)
    retryDelay: 1000,              // base delay in ms with exponential backoff + jitter (default: 1000)
    headers: {},                   // extra headers on refresh requests
    fetchOptions: {},              // extra RequestInit options (e.g. { credentials: 'include' })
  },

  // Cross-tab sync (default: true; automatically disabled for memory storage)
  syncTabs: true,

  // BroadcastChannel name for sync (default: 'tokensmith')
  syncChannelName: 'tokensmith',

  // Called when a refresh fails (retries exhausted, 401/403 rejection, or no refresh token)
  onAuthFailure: () => {},
});
```

## Storage Backends

| Value | Description | XSS Risk | Persistence |
|-------|-------------|----------|-------------|
| `'cookie'` (default) | `document.cookie` with `SameSite=Strict; Secure` | Low (readable by JS) | Persists |
| `'memory'` | In-memory `Map` | None | Lost on page refresh |
| `'localStorage'` | `window.localStorage` with `tk_` prefix | High | Persists |
| Custom `StorageAdapter` | Implement `get / set / remove / clear` | Yours | Yours |

### Custom adapter

```ts
const auth = createTokenManager({
  storage: {
    get: (key) => sessionStorage.getItem(key),
    set: (key, value) => sessionStorage.setItem(key, value),
    remove: (key) => sessionStorage.removeItem(key),
    clear: () => ['tk_access', 'tk_refresh'].forEach((k) => sessionStorage.removeItem(k)),
  },
});
```

### Cookie options

Token cookies are stored as `tk_access` and `tk_refresh`.

```ts
const auth = createTokenManager({
  cookie: {
    path: '/',
    domain: '.example.com',  // omit for current domain
    sameSite: 'strict',      // 'strict' | 'lax' | 'none'
    secure: true,            // auto-detected from location.protocol when omitted
    maxAge: 'auto',          // derives expiry from JWT exp claim; omit for session cookie
  },
});
```

## Cross-Tab Sync

Cross-tab sync is enabled by default for persistent storage backends (`cookie` and `localStorage`). Logout, login, and token refresh in one tab are reflected in all other tabs instantly via `BroadcastChannel`, with a `localStorage` `storage` event fallback for older browsers.

### Disabling sync

Set `syncTabs: false` to opt out. When disabled, each tab operates independently — a logout in one tab will not affect other tabs.

```ts
const auth = createTokenManager({
  syncTabs: false,
});
```

Sync is always disabled automatically when using `memory` storage, since there is no shared state between tabs.

### Custom channel name

If your application creates multiple `TokenManager` instances (e.g. separate user and admin sessions), give each one a unique channel name to prevent cross-talk:

```ts
const userAuth = createTokenManager({
  syncChannelName: 'tokensmith:user',
});

const adminAuth = createTokenManager({
  syncChannelName: 'tokensmith:admin',
});
```

The default channel name is `'tokensmith'`.

## Auto-Refresh

### Endpoint protocol

When `refresh.endpoint` is set, TokenSmith sends:

```
POST <endpoint>
Content-Type: application/json

{ "refreshToken": "<token>" }
```

The endpoint must respond with `{ "accessToken": "...", "refreshToken": "..." }`. The `refreshToken` field in the response is optional — include it to rotate the refresh token on each use.

### Configuration

```ts
const auth = createTokenManager({
  refresh: {
    // Option A: URL
    endpoint: '/api/auth/refresh',

    // Option B: Custom handler (use for non-standard request formats, auth headers, etc.)
    handler: async (refreshToken) => {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      return res.json(); // must return { accessToken, refreshToken? }
    },

    buffer: 60,       // refresh 60s before expiry (default: 60)
    maxRetries: 3,    // retry attempts on failure (default: 3)
    retryDelay: 1000, // base delay in ms; exponential backoff with jitter (default: 1000)
    headers: {        // extra headers sent with every refresh request
      'x-client-id': 'my-app',
    },
    fetchOptions: {   // extra RequestInit options (credentials, cache, etc.)
      credentials: 'include',
    },
  },
  onAuthFailure: () => {
    // Called when a refresh fails for any reason (retries exhausted, 401/403, no refresh token)
    window.location.href = '/login';
  },
});
```

`getAccessToken()` and `createAuthFetch()` both trigger an on-demand refresh if the access token is expired. Concurrent callers share one refresh request — the underlying function is called exactly once regardless of how many callers are waiting.

Retry backoff uses exponential delay with random jitter to prevent synchronized retry storms across tabs. If the refresh endpoint returns **401** or **403**, retries are skipped entirely — the token has been rejected and retrying will never succeed. `onAuthFailure` fires immediately in this case.

Auto-refresh is offline-aware: if `navigator.onLine` is `false`, the retry is deferred until the `online` event fires rather than burning through retry attempts.

## SSR Support

`fromCookieHeader()` parses a raw `Cookie:` request header string and returns the token pair. It works with any storage backend, so you can safely use `memory` storage on the server (where `document` is unavailable).

```ts
import { createTokenManager } from 'tokensmith';

// Next.js, Express, or any server framework — use memory storage on the server
const auth = createTokenManager({ storage: 'memory' });

const tokens = auth.fromCookieHeader(request.headers.get('cookie') ?? '');
if (tokens) {
  auth.setTokens(tokens);
}

const user = auth.getUser(); // typed payload or null
```

On the client, after hydration, `useAuth()` immediately reflects the browser's actual auth state. For seamless SSR without a flash of unauthenticated content, initialize the server-side manager with `fromCookieHeader` before rendering.

## TypeScript

Pass a type argument to `createTokenManager<TUser>` for fully typed `user` and `getUser()` return values:

```ts
interface UserPayload {
  sub: string;
  email: string;
  role: 'admin' | 'user';
}

const auth = createTokenManager<UserPayload>({
  refresh: { endpoint: '/api/auth/refresh' },
});

const user = auth.getUser(); // UserPayload | null
```

In React:

```tsx
const { user } = useAuth<UserPayload>(); // user: UserPayload | null
```

## Errors

TokenSmith exports typed error classes for every failure mode:

| Class | Code | When thrown |
|-------|------|-------------|
| `TokenSmithError` | — | Base class; all errors extend this |
| `InvalidTokenError` | `INVALID_TOKEN` | Malformed JWT — wrong segment count, invalid base64, or non-JSON payload |
| `TokenExpiredError` | `TOKEN_EXPIRED` | Not thrown internally — exported for use in custom refresh handlers or storage adapters |
| `RefreshFailedError` | `REFRESH_FAILED` | All retry attempts exhausted; has an `attempts: number` property |
| `StorageError` | `STORAGE_ERROR` | Storage unavailable (SSR context, quota exceeded, private browsing) |
| `NetworkError` | `NETWORK_ERROR` | Network request failed |

```ts
import { RefreshFailedError, TokenSmithError } from 'tokensmith';

auth.onAuthChange((state) => {
  if (state.error instanceof RefreshFailedError) {
    console.error(`Refresh failed after ${state.error.attempts} attempts`);
  }
  if (state.error instanceof TokenSmithError) {
    console.error(`Auth error [${state.error.code}]:`, state.error.message);
  }
});
```

## Security

> **TokenSmith decodes JWTs client-side but does not validate signatures.** Always verify token signatures server-side using a library like [jose](https://github.com/panva/jose) or your framework's JWT middleware. Never rely solely on the client-decoded payload for authorization decisions.

| Storage | XSS Risk | CSRF Risk | Persistence | Recommended For |
|---------|----------|-----------|-------------|-----------------|
| `memory` | None | None | Lost on refresh | SPAs with a server-side refresh endpoint |
| `cookie` | Readable by JS | Mitigated by SameSite=Strict | Persists | Most web apps (default) |
| `localStorage` | Full exposure | None | Persists | Only when the trade-off is acceptable |

**TokenSmith cookies are not HttpOnly** — the access token must be readable by JavaScript. For true HttpOnly refresh tokens, pass a custom `StorageAdapter` backed by a server-side token endpoint.

Memory storage is the most XSS-resistant option. Pair it with `refresh.endpoint` so the access token can be restored from the persisted refresh token on page load.

### Maximum security configuration

The most XSS-resistant setup stores the access token in memory and relies on a server-set HttpOnly cookie as the refresh credential — the cookie is never readable by JavaScript:

```ts
const auth = createTokenManager({
  storage: 'memory',
  refresh: {
    handler: async () => {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include', // sends the HttpOnly refresh cookie automatically
      });
      return res.json(); // { accessToken: string }
    },
  },
});
```

- **Access token** — lives only in memory; XSS cannot read it from storage
- **Refresh token** — a server-set HttpOnly cookie; invisible to JavaScript entirely
- **On page reload** — memory is empty, so the consumer must bootstrap the session on mount (e.g. call the refresh endpoint directly and pass the result to `setTokens`). No token is ever stored in script-accessible storage

## Compatibility

| Target | Requirement |
|--------|-------------|
| Browsers | Chrome 80+, Firefox 80+, Safari 15+, Edge 80+ |
| Node.js | 18+ (SSR contexts) |
| React | 18+ (`useSyncExternalStore`) |
| TypeScript | 5.0+ |
| Module formats | ESM + CommonJS |

Cross-tab sync uses `BroadcastChannel`. In environments where it is unavailable, TokenSmith falls back to a `localStorage` `storage` event automatically.

## Bundle Size

| Entry | Gzipped |
|-------|---------|
| `tokensmith` | ~5 KB |
| `tokensmith/react` | <1 KB |

Zero runtime dependencies. The React adapter wraps React's built-in `useSyncExternalStore` — no extra runtime code.

## Examples

The [`examples/`](./examples) directory contains a complete full-stack demo:

| App | Stack | What it shows |
|-----|-------|---------------|
| [`react-app`](./examples/react-app) | Vite + React 19 + React Router | Login, protected routes, auto-refresh countdown, cross-tab sync |
| [`nestjs-api`](./examples/nestjs-api) | NestJS 11 + Passport/JWT | Auth API: `/auth/login`, `/auth/refresh`, `/auth/profile` |

The React example demonstrates a **hybrid storage adapter** — access token kept in memory (never touches disk), refresh token persisted in `localStorage` — alongside how to perform a silent refresh on page load to restore the session without an authenticated flash.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release history.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Found a bug or have a feature request? [Open an issue](https://github.com/aqib-io/tokensmith/issues).

## License

MIT — see [LICENSE](./LICENSE).
