import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../config";
import { manager } from "../auth";


const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
  },
  card: {
    background: "#fff",
    borderRadius: 12,
    padding: "40px 36px",
    width: 360,
    boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
  },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 8 },
  subtitle: { fontSize: 13, color: "#666", marginBottom: 28 },
  label: { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 },
  input: {
    width: "100%",
    padding: "9px 12px",
    border: "1px solid #ddd",
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 16,
    boxSizing: "border-box" as const,
  },
  button: {
    width: "100%",
    padding: "10px",
    background: "#0f172a",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 4,
  },
  error: {
    color: "#dc2626",
    fontSize: 13,
    marginBottom: 12,
    padding: "8px 12px",
    background: "#fef2f2",
    borderRadius: 6,
  },
  hint: { fontSize: 12, color: "#888", marginTop: 16, textAlign: "center" },
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        setError("Invalid username or password");
        return;
      }

      const tokens = (await res.json()) as {
        accessToken: string;
        refreshToken: string;
      };
      manager.setTokens(tokens);
      navigate("/dashboard");
    } catch {
      setError("Could not connect to API. Is NestJS running on port 3000?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.title}>tokensmith demo</div>
        <div style={styles.subtitle}>Sign in to see token management in action</div>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <label htmlFor="username" style={styles.label}>Username</label>
          <input
            id="username"
            style={styles.input}
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="alice"
            autoComplete="username"
            required
          />
          <label htmlFor="password" style={styles.label}>Password</label>
          <input
            id="password"
            style={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div style={styles.hint}>
          Try: alice / password123 &nbsp;·&nbsp; bob / password456
        </div>
      </div>
    </div>
  );
}
