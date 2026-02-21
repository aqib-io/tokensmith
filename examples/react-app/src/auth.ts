import { createTokenManager, type StorageAdapter } from "tokensmith";
import { API_URL } from "./config";

export interface UserPayload {
  sub: number;
  username: string;
  email: string;
  role: string;
}

// ─── Option 1: sessionStorage ─────────────────────────────────
// Survives page refresh. Cleared when the tab is closed.
// No cross-tab sync (each tab has its own sessionStorage).
const SESSION_KEYS = ["tk_access", "tk_refresh"];

export const sessionStorageAdapter: StorageAdapter = {
  get: (key) => sessionStorage.getItem(key),
  set: (key, value) => sessionStorage.setItem(key, value),
  remove: (key) => sessionStorage.removeItem(key),
  clear: () => SESSION_KEYS.forEach((k) => sessionStorage.removeItem(k)),
};

// ─── Option 2: Hybrid ─────────────────────────────────────────
// Access token: memory only (never touches disk — most secure).
// Refresh token: localStorage (survives page refresh).
// On page reload: access token is gone, but tokensmith uses the
// persisted refresh token to obtain a new one on the first
// getAccessToken() / createAuthFetch() call.
const memoryStore = new Map<string, string>();

export const hybridAdapter: StorageAdapter = {
  get: (key) =>
    key === "tk_access" ? (memoryStore.get(key) ?? null) : localStorage.getItem(key),
  set: (key, value) => {
    if (key === "tk_access") {
      memoryStore.set(key, value);
    } else {
      localStorage.setItem(key, value);
    }
  },
  remove: (key) => {
    if (key === "tk_access") {
      memoryStore.delete(key);
    } else {
      localStorage.removeItem(key);
    }
  },
  clear: () => {
    memoryStore.delete("tk_access");
    localStorage.removeItem("tk_refresh");
  },
};

// ─── Switch between approaches here ──────────────────────────
// When using hybridAdapter, also ensure silentRefresh() is called in main.tsx
// on page load so the access token is restored from the persisted refresh token.
const STORAGE = sessionStorageAdapter; // swap to hybridAdapter to try Option 2
// const STORAGE = "localStorage" as const;
export const manager = createTokenManager<UserPayload>({
  storage: STORAGE,
  refresh: {
    endpoint: `${API_URL}/auth/refresh`,
    buffer: 10,
    maxRetries: 3,
  },
  syncTabs: true,
  onAuthFailure: () => {
    window.location.href = "/login";
  },
});
