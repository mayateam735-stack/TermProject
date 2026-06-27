import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { HeartPulse } from "lucide-react";
import { useAuth } from "../auth.jsx";
import PulseLine from "../components/PulseLine.jsx";

export default function SignIn() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(form);
      navigate("/triage", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <div className="auth-screen">
        <span className="logo logo-lg"><HeartPulse size={34} /></span>
        <PulseLine />
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-sub">Sign in to continue to HealthNav.</p>

        <form className="auth-card" onSubmit={submit}>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@example.com" required />

          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Your password" required />

          {error && <p className="auth-error">{error}</p>}

          <button className="btn" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="auth-switch">
          New here? <Link to="/signup">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
