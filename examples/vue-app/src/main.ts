import { createApp } from "vue";
import { createTokenSmithPlugin } from "tokensmith/vue";
import App from "./App.vue";
import router from "./router";
import { API_URL } from "./config";
import { manager } from "./auth";

async function silentRefresh(): Promise<void> {
  if (manager.isAuthenticated()) return;

  // Hybrid adapter: access token is gone after page reload but the refresh
  // token persists in localStorage. Do a direct refresh call before rendering
  // so the route guard never sees an unauthenticated flash.
  const storedRefresh = localStorage.getItem("tk_refresh");
  if (!storedRefresh) return;

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: storedRefresh }),
    });
    if (res.ok)
      manager.setTokens(
        (await res.json()) as { accessToken: string; refreshToken: string },
      );
    else localStorage.removeItem("tk_refresh");
  } catch (err) {
    console.error("[tokensmith] Silent refresh failed:", err);
  }
}

silentRefresh().then(() => {
  const app = createApp(App);
  app.use(createTokenSmithPlugin(manager));
  app.use(router);
  app.mount("#app");
});
