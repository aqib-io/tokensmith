import { useEffect, useRef, useState } from "react";
import { useAuth } from "tokensmith/react";
import { API_URL } from "../config";
import type { UserPayload } from "../auth";
import { manager } from "../auth";

const authFetch = manager.createAuthFetch();

/** Decodes the `exp` and `iat` claims from a JWT without verifying the signature. */
function decodeToken(token: string | null): { exp: number; iat: number } | null {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const decoded = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    ) as { exp?: number; iat?: number };
    if (!decoded.exp || !decoded.iat) return null;
    return { exp: decoded.exp, iat: decoded.iat };
  } catch {
    return null;
  }
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 700, margin: "0 auto", padding: "36px 20px", fontFamily: "system-ui, sans-serif" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 },
  headerActions: { display: "flex", gap: 8, alignItems: "center" },
  title: { fontSize: 20, fontWeight: 700 },
  card: {
    background: "#fff",
    borderRadius: 12,
    padding: "22px 26px",
    marginBottom: 18,
    boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: "#888",
    marginBottom: 14,
    textTransform: "uppercase" as const,
    letterSpacing: "0.07em",
  },
  row: { display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #f0f0f0" },
  label: { fontSize: 13, color: "#666" },
  value: { fontSize: 13, fontWeight: 600 },
  badge: { fontSize: 11, padding: "3px 10px", borderRadius: 99, fontWeight: 700 },
  token: {
    fontSize: 11,
    fontFamily: "monospace",
    background: "#f5f5f5",
    padding: "8px 10px",
    borderRadius: 6,
    wordBreak: "break-all" as const,
    marginTop: 8,
    color: "#333",
  },
  btn: { padding: "8px 16px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", marginRight: 8 },
  profileBox: {
    marginTop: 12,
    background: "#f8f8f8",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 12,
    fontFamily: "monospace",
    whiteSpace: "pre-wrap" as const,
  },
  refreshBar: { height: 6, borderRadius: 3, background: "#e5e7eb", overflow: "hidden", marginTop: 12 },
  refreshBarHint: { fontSize: 11, color: "#aaa", marginTop: 6 },
  tokenHint: { fontSize: 11, color: "#aaa", marginTop: 6 },
  flashOverlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(16,185,129,0.15)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
    pointerEvents: "none" as const,
  },
  flashMsg: { background: "#059669", color: "#fff", padding: "14px 28px", borderRadius: 12, fontSize: 16, fontWeight: 700 },
};

export default function DashboardPage() {
  const { user, accessToken, isRefreshing, logout } = useAuth<UserPayload>();
  const [profile, setProfile] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [secsLeft, setSecsLeft] = useState<number | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const [showFlash, setShowFlash] = useState(false);
  const prevToken = useRef<string | null>(null);

  // Detect when the access token changes — a background refresh completed.
  useEffect(() => {
    if (accessToken && prevToken.current && accessToken !== prevToken.current) {
      setRefreshCount((n) => n + 1);
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 1800);
    }
    prevToken.current = accessToken;
  }, [accessToken]);

  // Live countdown to the next token expiry.
  useEffect(() => {
    const tick = () => {
      const times = decodeToken(accessToken);
      setSecsLeft(times ? Math.max(0, times.exp - Math.floor(Date.now() / 1000)) : null);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [accessToken]);

  async function fetchProfile() {
    setFetching(true);
    try {
      const res = await authFetch(`${API_URL}/auth/profile`);
      const data = (await res.json()) as unknown;
      setProfile(JSON.stringify(data, null, 2));
    } catch {
      setProfile("Error fetching profile");
    } finally {
      setFetching(false);
    }
  }

  // Derive the token's total lifetime from its own iat/exp claims so the
  // progress bar stays accurate regardless of the configured expiry window.
  const tokenTimes = decodeToken(accessToken);
  const totalSecs = tokenTimes ? tokenTimes.exp - tokenTimes.iat : 30;
  const progress = secsLeft !== null ? (secsLeft / totalSecs) * 100 : 100;
  const isUrgent = secsLeft !== null && secsLeft <= 10;
  const barColor = isUrgent ? "#f59e0b" : "#10b981";

  return (
    <div style={styles.page}>
      {showFlash && (
        <div style={styles.flashOverlay}>
          <div style={styles.flashMsg}>Token refreshed #{refreshCount}</div>
        </div>
      )}

      <div style={styles.header}>
        <div style={styles.title}>tokensmith demo</div>
        <div style={styles.headerActions}>
          {isRefreshing && (
            <span style={{ ...styles.badge, background: "#fef9c3", color: "#92400e" }}>Refreshing…</span>
          )}
          <span style={{ ...styles.badge, background: "#dcfce7", color: "#166534" }}>Authenticated</span>
        </div>
      </div>

      {/* Token lifecycle */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Token Lifecycle</div>
        <div style={styles.row}>
          <span style={styles.label}>Expires in</span>
          <span style={{ ...styles.value, color: isUrgent ? "#d97706" : "#059669", fontVariantNumeric: "tabular-nums" }}>
            {secsLeft !== null ? `${secsLeft}s` : "—"}
          </span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Auto-refresh at</span>
          <span style={styles.value}>≤ 10s remaining</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Successful refreshes</span>
          <span style={{ ...styles.value, color: "#059669" }}>{refreshCount}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>isRefreshing</span>
          <span style={{ ...styles.value, color: isRefreshing ? "#d97706" : "#6b7280" }}>
            {isRefreshing ? "true" : "false"}
          </span>
        </div>
        <div style={styles.refreshBar}>
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              background: barColor,
              transition: "width 0.5s linear, background 0.3s",
            }}
          />
        </div>
        <div style={styles.refreshBarHint}>
          Bar drains to zero → tokensmith fires POST /auth/refresh → bar resets
        </div>
      </div>

      {/* User */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>User (decoded from JWT)</div>
        {(["username", "email", "role"] as const).map((k) => (
          <div style={styles.row} key={k}>
            <span style={styles.label}>{k}</span>
            <span style={styles.value}>{user?.[k] ?? "—"}</span>
          </div>
        ))}
      </div>

      {/* Token */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Access Token (changes on every refresh)</div>
        <div style={styles.token}>{accessToken ? `${accessToken.slice(0, 72)}…` : "—"}</div>
        <div style={styles.tokenHint}>
          Inspect the full value in DevTools → Application → Session Storage → tk_access
        </div>
      </div>

      {/* Actions */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Actions</div>
        <div style={{ marginBottom: profile ? 0 : 4 }}>
          <button
            style={{ ...styles.btn, background: "#0f172a", color: "#fff" }}
            onClick={fetchProfile}
            disabled={fetching}
          >
            {fetching ? "Fetching…" : "GET /auth/profile"}
          </button>
          <button
            style={{ ...styles.btn, background: "#fee2e2", color: "#991b1b" }}
            onClick={logout}
          >
            Logout
          </button>
        </div>
        {profile && <div style={styles.profileBox}>{profile}</div>}
      </div>

      {/* Cross-tab */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Cross-tab Sync</div>
        <div style={{ fontSize: 13, color: "#555", lineHeight: 1.6 }}>
          Open this page in a second tab. Logging out in either tab will instantly
          log out both — powered by tokensmith's BroadcastChannel sync.
        </div>
      </div>
    </div>
  );
}
