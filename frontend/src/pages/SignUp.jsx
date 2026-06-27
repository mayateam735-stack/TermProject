import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { HeartPulse } from "lucide-react";
import { useAuth } from "../auth.jsx";
import PulseLine from "../components/PulseLine.jsx";

export default function SignUp() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "", email: "", password: "", age: "", sex: "", conditions: "",
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signup({
        name: form.name,
        email: form.email,
        password: form.password,
        age: form.age ? Number(form.age) : null,
        sex: form.sex || null,
        conditions: form.conditions.trim() || null,
      });
      navigate("/home", { replace: true });
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
            onChange={set("name")} placeholder="Jordan Lee" required />

          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" value={form.email}
            onChange={set("email")} placeholder="you@example.com" required />

          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="new-password" value={form.password}
            onChange={set("password")} placeholder="At least 8 characters" minLength={8} required />

          <div className="field-row">
            <div>
              <label htmlFor="age">Age</label>
              <input id="age" type="number" min="0" max="120" value={form.age}
                onChange={set("age")} placeholder="e.g. 34" required />
            </div>
            <div>
              <label htmlFor="sex">Sex</label>
              <select id="sex" className="field" value={form.sex} onChange={set("sex")}>
                <option value="">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <label htmlFor="conditions">Existing conditions</label>
          <textarea id="conditions" value={form.conditions} onChange={set("conditions")}
            placeholder="e.g. asthma, high blood pressure — or “none”" rows={2} />

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
