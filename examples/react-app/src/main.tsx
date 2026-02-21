import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { TokenProvider } from "tokensmith/react";
import { API_URL } from "./config";
import App from "./App";
import { manager } from "./auth";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

async function silentRefresh(): Promise<void> {
  if (manager.isAuthenticated()) return;

  // Hybrid adapter: access token is gone after page reload but the refresh
  // token persists in localStorage. Do a direct refresh call before rendering
  // so ProtectedRoute never sees an unauthenticated flash.
  const storedRefresh = localStorage.getItem("tk_refresh");
  if (!storedRefresh) return;

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: storedRefresh }),
    });
    if (res.ok) manager.setTokens((await res.json()) as { accessToken: string; refreshToken: string });
    else localStorage.removeItem("tk_refresh");
  } catch (err) {
    // Network error — leave unauthenticated, ProtectedRoute handles redirect
    console.error("[tokensmith] Silent refresh failed:", err);
  }
}

silentRefresh().then(() => {
  createRoot(root).render(
    <StrictMode>
      <BrowserRouter>
        <TokenProvider manager={manager}>
          <App />
        </TokenProvider>
      </BrowserRouter>
    </StrictMode>,
  );
});
