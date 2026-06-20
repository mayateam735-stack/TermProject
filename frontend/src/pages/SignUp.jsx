import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { HeartPulse } from "lucide-react";
import { useAuth } from "../auth.jsx";
import PulseLine from "../components/PulseLine.jsx";

export default function SignUp() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signup(form);
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
        <h1 className="auth-title">Create your account</h1>
        <p className="auth-sub">Your private health navigator — guidance, not diagnosis.</p>

        <form className="auth-card" onSubmit={submit}>
          <label htmlFor="name">Full name</label>
          <input id="name" autoComplete="name" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Jordan Lee" required />

          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@example.com" required />

          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="new-password" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="At least 8 characters" minLength={8} required />

          {error && <p className="auth-error">{error}</p>}

          <button className="btn" type="submit" disabled={busy}>
            {busy ? "Creating account…" : "Sign up"}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
