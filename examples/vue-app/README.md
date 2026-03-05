# tokensmith — Vue App Example

A Vite + Vue 3 SPA that demonstrates every major tokensmith feature against the [nestjs-api](../nestjs-api) backend.

## Features demonstrated

| Feature | Where |
|---------|-------|
| `createTokenManager` with custom `StorageAdapter` | `src/auth.ts` |
| `sessionStorage` adapter (survives page refresh, isolated per tab) | `src/auth.ts` |
| Hybrid adapter (access token in memory, refresh token in localStorage) | `src/auth.ts` |
| `createTokenSmithPlugin` + `useAuth()` composable | `src/main.ts`, `src/pages/DashboardPage.vue` |
| `createAuthFetch()` for authenticated requests | `src/pages/DashboardPage.vue` |
| Silent refresh on page reload (hybrid mode) | `src/main.ts` |
| Auto-refresh countdown — watch token renew itself | `src/pages/DashboardPage.vue` |
| `syncTabs: true` — logout in one tab logs out all tabs | `src/auth.ts` |
| Vue Router navigation guard for protected routes | `src/router.ts` |

## Quick start

1. Start the NestJS API first (see [../nestjs-api](../nestjs-api))
2. Then:

```bash
npm install
npm run dev   # http://localhost:5174
```

3. Log in with `alice / password123` or `bob / password456`

## Storage adapters

`src/auth.ts` defines two adapters. Swap the `STORAGE` constant to try each:

```typescript
// Option 1 — sessionStorage (default)
// Survives page refresh. Cleared when the tab is closed.
const STORAGE = sessionStorageAdapter;

// Option 2 — Hybrid (access token in memory, refresh token in localStorage)
// Most secure: access token never touches disk.
// Requires silentRefresh() in main.ts on page load.
const STORAGE = hybridAdapter;
```

## Environment variables

Copy `.env.example` and adjust as needed:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:3000` | Base URL of the NestJS API |
