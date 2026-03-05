<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useAuth } from "tokensmith/vue";
import { API_URL } from "../config";
import type { UserPayload } from "../auth";
import { manager } from "../auth";

const authFetch = manager.createAuthFetch();

const { state, logout } = useAuth<UserPayload>();

const profile = ref<string | null>(null);
const fetching = ref(false);
const secsLeft = ref<number | null>(null);
const refreshCount = ref(0);
const showFlash = ref(false);
let flashTimeout: ReturnType<typeof setTimeout> | undefined;
let tickInterval: ReturnType<typeof setInterval> | undefined;

const accessToken = computed(() => state.value.accessToken);
const user = computed(() => state.value.user);
const isRefreshing = computed(() => state.value.isRefreshing);

function decodeToken(
  token: string | null,
): { exp: number; iat: number } | null {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const decoded = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { exp?: number; iat?: number };
    if (!decoded.exp || !decoded.iat) return null;
    return { exp: decoded.exp, iat: decoded.iat };
  } catch {
    return null;
  }
}

const tokenTimes = computed(() => decodeToken(accessToken.value));
const totalSecs = computed(() =>
  tokenTimes.value ? tokenTimes.value.exp - tokenTimes.value.iat : 30,
);
const progress = computed(() =>
  secsLeft.value !== null ? (secsLeft.value / totalSecs.value) * 100 : 100,
);
const isUrgent = computed(
  () => secsLeft.value !== null && secsLeft.value <= 10,
);
const barColor = computed(() => (isUrgent.value ? "#f59e0b" : "#10b981"));

let prevToken: string | null = null;

watch(accessToken, (newToken) => {
  if (newToken && prevToken && newToken !== prevToken) {
    refreshCount.value++;
    showFlash.value = true;
    clearTimeout(flashTimeout);
    flashTimeout = setTimeout(() => (showFlash.value = false), 1800);
  }
  prevToken = newToken;
});

function tick() {
  const times = decodeToken(accessToken.value);
  secsLeft.value = times
    ? Math.max(0, times.exp - Math.floor(Date.now() / 1000))
    : null;
}

onMounted(() => {
  prevToken = accessToken.value;
  tick();
  tickInterval = setInterval(tick, 500);
});

onUnmounted(() => {
  clearInterval(tickInterval);
  clearTimeout(flashTimeout);
});

async function fetchProfile() {
  fetching.value = true;
  try {
    const res = await authFetch(`${API_URL}/auth/profile`);
    const data = (await res.json()) as unknown;
    profile.value = JSON.stringify(data, null, 2);
  } catch {
    profile.value = "Error fetching profile";
  } finally {
    fetching.value = false;
  }
}
</script>

<template>
  <div :style="styles.page">
    <!-- Refresh flash overlay -->
    <div v-if="showFlash" :style="styles.flashOverlay">
      <div :style="styles.flashMsg">Token refreshed #{{ refreshCount }}</div>
    </div>

    <!-- Header -->
    <div :style="styles.header">
      <div :style="styles.title">tokensmith demo</div>
      <div :style="styles.headerActions">
        <span
          v-if="isRefreshing"
          :style="{
            ...styles.badge,
            background: '#fef9c3',
            color: '#92400e',
          }"
        >
          Refreshing…
        </span>
        <span
          :style="{
            ...styles.badge,
            background: '#dcfce7',
            color: '#166534',
          }"
        >
          Authenticated
        </span>
      </div>
    </div>

    <!-- Token lifecycle -->
    <div :style="styles.card">
      <div :style="styles.cardTitle">Token Lifecycle</div>
      <div :style="styles.row">
        <span :style="styles.label">Expires in</span>
        <span
          :style="{
            ...styles.value,
            color: isUrgent ? '#d97706' : '#059669',
            fontVariantNumeric: 'tabular-nums',
          }"
        >
          {{ secsLeft !== null ? `${secsLeft}s` : "—" }}
        </span>
      </div>
      <div :style="styles.row">
        <span :style="styles.label">Auto-refresh at</span>
        <span :style="styles.value">≤ 10s remaining</span>
      </div>
      <div :style="styles.row">
        <span :style="styles.label">Successful refreshes</span>
        <span :style="{ ...styles.value, color: '#059669' }">{{
          refreshCount
        }}</span>
      </div>
      <div :style="styles.row">
        <span :style="styles.label">isRefreshing</span>
        <span
          :style="{
            ...styles.value,
            color: isRefreshing ? '#d97706' : '#6b7280',
          }"
        >
          {{ isRefreshing ? "true" : "false" }}
        </span>
      </div>
      <div :style="styles.refreshBar">
        <div
          :style="{
            height: '100%',
            width: `${progress}%`,
            background: barColor,
            transition: 'width 0.5s linear, background 0.3s',
          }"
        />
      </div>
      <div :style="styles.refreshBarHint">
        Bar drains to zero → tokensmith fires POST /auth/refresh → bar resets
      </div>
    </div>

    <!-- User -->
    <div :style="styles.card">
      <div :style="styles.cardTitle">User (decoded from JWT)</div>
      <div v-for="k in (['username', 'email', 'role'] as const)" :key="k" :style="styles.row">
        <span :style="styles.label">{{ k }}</span>
        <span :style="styles.value">{{ user?.[k] ?? "—" }}</span>
      </div>
    </div>

    <!-- Token -->
    <div :style="styles.card">
      <div :style="styles.cardTitle">
        Access Token (changes on every refresh)
      </div>
      <div :style="styles.token">
        {{ accessToken ? `${accessToken.slice(0, 72)}…` : "—" }}
      </div>
      <div :style="styles.tokenHint">
        Inspect the full value in DevTools → Application → Session Storage →
        tk_access
      </div>
    </div>

    <!-- Actions -->
    <div :style="styles.card">
      <div :style="styles.cardTitle">Actions</div>
      <div :style="{ marginBottom: profile ? '0' : '4px' }">
        <button
          :style="{ ...styles.btn, background: '#0f172a', color: '#fff' }"
          :disabled="fetching"
          @click="fetchProfile"
        >
          {{ fetching ? "Fetching…" : "GET /auth/profile" }}
        </button>
        <button
          :style="{ ...styles.btn, background: '#fee2e2', color: '#991b1b' }"
          @click="logout"
        >
          Logout
        </button>
      </div>
      <div v-if="profile" :style="styles.profileBox">{{ profile }}</div>
    </div>

    <!-- Cross-tab -->
    <div :style="styles.card">
      <div :style="styles.cardTitle">Cross-tab Sync</div>
      <div :style="{ fontSize: '13px', color: '#555', lineHeight: '1.6' }">
        Open this page in a second tab. Logging out in either tab will instantly
        log out both — powered by tokensmith's BroadcastChannel sync.
      </div>
    </div>
  </div>
</template>

<script lang="ts">
const styles: Record<string, Record<string, string | number>> = {
  page: {
    maxWidth: "700px",
    margin: "0 auto",
    padding: "36px 20px",
    fontFamily: "system-ui, sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "28px",
  },
  headerActions: { display: "flex", gap: "8px", alignItems: "center" },
  title: { fontSize: "20px", fontWeight: 700 },
  card: {
    background: "#fff",
    borderRadius: "12px",
    padding: "22px 26px",
    marginBottom: "18px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
  },
  cardTitle: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#888",
    marginBottom: "14px",
    textTransform: "uppercase",
    letterSpacing: "0.07em",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    padding: "7px 0",
    borderBottom: "1px solid #f0f0f0",
  },
  label: { fontSize: "13px", color: "#666" },
  value: { fontSize: "13px", fontWeight: 600 },
  badge: {
    fontSize: "11px",
    padding: "3px 10px",
    borderRadius: "99px",
    fontWeight: 700,
  },
  token: {
    fontSize: "11px",
    fontFamily: "monospace",
    background: "#f5f5f5",
    padding: "8px 10px",
    borderRadius: "6px",
    wordBreak: "break-all",
    marginTop: "8px",
    color: "#333",
  },
  btn: {
    padding: "8px 16px",
    border: "none",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    marginRight: "8px",
  },
  profileBox: {
    marginTop: "12px",
    background: "#f8f8f8",
    borderRadius: "8px",
    padding: "10px 14px",
    fontSize: "12px",
    fontFamily: "monospace",
    whiteSpace: "pre-wrap",
  },
  refreshBar: {
    height: "6px",
    borderRadius: "3px",
    background: "#e5e7eb",
    overflow: "hidden",
    marginTop: "12px",
  },
  refreshBarHint: { fontSize: "11px", color: "#aaa", marginTop: "6px" },
  tokenHint: { fontSize: "11px", color: "#aaa", marginTop: "6px" },
  flashOverlay: {
    position: "fixed",
    inset: "0",
    background: "rgba(16,185,129,0.15)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
    pointerEvents: "none",
  },
  flashMsg: {
    background: "#059669",
    color: "#fff",
    padding: "14px 28px",
    borderRadius: "12px",
    fontSize: "16px",
    fontWeight: 700,
  },
};
</script>
