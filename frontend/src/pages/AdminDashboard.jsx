import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, ChevronRight, LogIn, MousePointerClick, Pill, TrendingUp, Users } from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api } from "../api.js";

const URGENCY = [
  { key: "emergency", label: "Emergency", color: "#ef4444" },
  { key: "urgent", label: "Urgent", color: "#f97316" },
  { key: "routine", label: "Routine", color: "#f59e0b" },
  { key: "self_care", label: "Self-care", color: "#22c55e" },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [s, setS] = useState(null);
  const [ts, setTs] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.adminStats().then(setS).catch((e) => setError(e.message));
    api.adminTimeseries(30).then(setTs).catch(() => setTs(null));
  }, []);

  if (error) return <section><div className="card" style={{ color: "var(--emergency)" }}>{error}</div></section>;
  if (!s) return <section><div className="card skeleton-row" /></section>;

  const urgencyData = URGENCY
    .map((u) => ({ name: u.label, value: s.checks.by_urgency[u.key], color: u.color }))
    .filter((d) => d.value > 0);
  const medData = s.top_medications.map((m) => ({ name: m.name, count: m.count }));
  const symptomData = s.common_symptoms.slice(0, 8).map((w) => ({ name: w.word, count: w.count }));

  const axis = { fontSize: 11, fill: "var(--muted)" };
  const tooltip = {
    contentStyle: { background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, color: "var(--ink)" },
    itemStyle: { color: "var(--ink)" }, labelStyle: { color: "var(--muted)" },
  };

  return (
    <section>
      <h2 className="page-title">Admin overview</h2>
      <p className="page-sub">Population insights across all HealthNav data.</p>

      <button className="card share-card" onClick={() => navigate("/admin/users")}>
        <div className="row" style={{ width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
            <span className="settings-icon"><Users size={18} /></span>
            <strong>Manage users</strong>
          </div>
          <ChevronRight size={18} color="var(--muted)" />
        </div>
        <p className="muted" style={{ margin: "0.5rem 0 0", fontSize: "0.85rem", textAlign: "left" }}>
          View, edit, change roles, or remove any patient or doctor.
        </p>
      </button>

      {/* Headline counts */}
      <div className="admin-grid">
        <div className="card stat-card">
          <span className="mini-icon"><Users size={16} /></span>
          <div className="stat-num">{s.users.total}</div>
          <div className="med-dose">{s.users.patients} patients · {s.users.doctors} doctors</div>
        </div>
        <div className="card stat-card">
          <span className="mini-icon"><Activity size={16} /></span>
          <div className="stat-num">{s.checks.total}</div>
          <div className="med-dose">symptom checks · {s.checks.last_7_days} this week</div>
        </div>
        <div className="card stat-card">
          <span className="mini-icon"><Pill size={16} /></span>
          <div className="stat-num">{s.reminders.total}</div>
          <div className="med-dose">medication reminders</div>
        </div>
      </div>

      {/* Engagement */}
      <div className="admin-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="card stat-card">
          <span className="mini-icon"><LogIn size={16} /></span>
          <div className="stat-num">{s.engagement?.total_logins ?? 0}</div>
          <div className="med-dose">total sign-ins</div>
        </div>
        <div className="card stat-card">
          <span className="mini-icon"><MousePointerClick size={16} /></span>
          <div className="stat-num">{s.engagement?.total_app_opens ?? 0}</div>
          <div className="med-dose">app opens</div>
        </div>
      </div>

      {/* Activity over time — 30-day trend */}
      <div className="card">
        <div className="row" style={{ marginBottom: "0.2rem" }}>
          <h2 style={{ margin: 0 }}>Activity — last 30 days</h2>
          <span className="mini-icon"><TrendingUp size={16} /></span>
        </div>
        <p className="med-dose" style={{ margin: "0.1rem 0 0.6rem" }}>
          {ts ? `${ts.totals.signups} sign-ups · ${ts.totals.checks} checks · ${ts.totals.doses} doses` : "Loading…"}
        </p>
        {!ts ? <div className="skeleton-row" /> : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={ts.series} margin={{ left: -20, right: 8, top: 4 }}>
              <defs>
                <linearGradient id="gChecks" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4f6df5" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#4f6df5" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gSignups" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0ea5a4" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#0ea5a4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
              <XAxis dataKey="date" tick={axis} interval={5} axisLine={false} tickLine={false} />
              <YAxis tick={axis} allowDecimals={false} axisLine={false} tickLine={false} width={28} />
              <Tooltip {...tooltip} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="checks" name="Checks" stroke="#4f6df5" strokeWidth={2} fill="url(#gChecks)" />
              <Area type="monotone" dataKey="signups" name="Sign-ups" stroke="#0ea5a4" strokeWidth={2} fill="url(#gSignups)" />
              <Area type="monotone" dataKey="doses" name="Doses" stroke="#8b5cf6" strokeWidth={2} fill="none" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Triage outcomes — donut */}
      <div className="card">
        <h2>Triage outcomes</h2>
        {urgencyData.length === 0 ? <p className="muted" style={{ margin: 0 }}>No checks yet.</p> : (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <ResponsiveContainer width="55%" height={180}>
              <PieChart>
                <Pie data={urgencyData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={78} paddingAngle={2}>
                  {urgencyData.map((d) => <Cell key={d.name} fill={d.color} stroke="none" />)}
                </Pie>
                <Tooltip {...tooltip} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1 }}>
              {urgencyData.map((d) => (
                <div key={d.name} className="row" style={{ marginBottom: "0.35rem", fontSize: "0.85rem" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color }} /> {d.name}
                  </span>
                  <b>{d.value}</b>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Top medications — bar */}
      <div className="card">
        <h2>Top medications</h2>
        {medData.length === 0 ? <p className="muted" style={{ margin: 0 }}>No medications yet.</p> : (
          <ResponsiveContainer width="100%" height={Math.max(140, medData.length * 38)}>
            <BarChart data={medData} layout="vertical" margin={{ left: 8, right: 16 }}>
              <XAxis type="number" tick={axis} allowDecimals={false} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={axis} width={90} axisLine={false} tickLine={false} />
              <Tooltip {...tooltip} cursor={{ fill: "var(--primary-soft)" }} />
              <Bar dataKey="count" fill="#4f6df5" radius={[0, 6, 6, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Common symptoms — bar */}
      <div className="card">
        <h2>Most common symptoms</h2>
        <p className="med-dose" style={{ marginTop: "-0.5rem", marginBottom: "0.6rem" }}>Basis for future self-care suggestions.</p>
        {symptomData.length === 0 ? <p className="muted" style={{ margin: 0 }}>No data yet.</p> : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={symptomData} margin={{ left: -18, right: 8 }}>
              <XAxis dataKey="name" tick={axis} interval={0} angle={-30} textAnchor="end" height={54} axisLine={false} tickLine={false} />
              <YAxis tick={axis} allowDecimals={false} axisLine={false} tickLine={false} />
              <Tooltip {...tooltip} cursor={{ fill: "var(--primary-soft)" }} />
              <Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <p className="disclaimer" style={{ textAlign: "center" }}>
        Aggregated, read-only analytics. Data stored in PostgreSQL (Neon) in production.
      </p>
    </section>
  );
}
