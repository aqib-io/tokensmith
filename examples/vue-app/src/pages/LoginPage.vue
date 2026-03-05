<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { API_URL } from "../config";
import { manager } from "../auth";

const router = useRouter();
const username = ref("");
const password = ref("");
const error = ref<string | null>(null);
const loading = ref(false);

async function handleSubmit() {
  error.value = null;
  loading.value = true;

  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username.value,
        password: password.value,
      }),
    });

    if (!res.ok) {
      error.value = "Invalid username or password";
      return;
    }

    const tokens = (await res.json()) as {
      accessToken: string;
      refreshToken: string;
    };
    manager.setTokens(tokens);
    router.push("/dashboard");
  } catch {
    error.value = "Could not connect to API. Is NestJS running on port 3000?";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div :style="styles.container">
    <div :style="styles.card">
      <div :style="styles.title">tokensmith demo</div>
      <div :style="styles.subtitle">
        Sign in to see token management in action
      </div>

      <div v-if="error" :style="styles.error">{{ error }}</div>

      <form @submit.prevent="handleSubmit">
        <label for="username" :style="styles.label">Username</label>
        <input
          id="username"
          v-model="username"
          :style="styles.input"
          type="text"
          placeholder="alice"
          autocomplete="username"
          required
        />
        <label for="password" :style="styles.label">Password</label>
        <input
          id="password"
          v-model="password"
          :style="styles.input"
          type="password"
          placeholder="••••••••"
          autocomplete="current-password"
          required
        />
        <button :style="styles.button" type="submit" :disabled="loading">
          {{ loading ? "Signing in…" : "Sign in" }}
        </button>
      </form>

      <div :style="styles.hint">
        Try: alice / password123 &nbsp;·&nbsp; bob / password456
      </div>
    </div>
  </div>
</template>

<script lang="ts">
const styles: Record<string, Record<string, string | number>> = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
  },
  card: {
    background: "#fff",
    borderRadius: "12px",
    padding: "40px 36px",
    width: "360px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
  },
  title: { fontSize: "22px", fontWeight: 700, marginBottom: "8px" },
  subtitle: { fontSize: "13px", color: "#666", marginBottom: "28px" },
  label: {
    display: "block",
    fontSize: "13px",
    fontWeight: 600,
    marginBottom: "6px",
  },
  input: {
    width: "100%",
    padding: "9px 12px",
    border: "1px solid #ddd",
    borderRadius: "8px",
    fontSize: "14px",
    marginBottom: "16px",
    boxSizing: "border-box",
  },
  button: {
    width: "100%",
    padding: "10px",
    background: "#0f172a",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    marginTop: "4px",
  },
  error: {
    color: "#dc2626",
    fontSize: "13px",
    marginBottom: "12px",
    padding: "8px 12px",
    background: "#fef2f2",
    borderRadius: "6px",
  },
  hint: {
    fontSize: "12px",
    color: "#888",
    marginTop: "16px",
    textAlign: "center",
  },
};
</script>
