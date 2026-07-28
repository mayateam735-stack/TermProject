import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ChevronRight, Pill, TrendingUp, Users } from "lucide-react";
import { api } from "../api.js";

const URGENCY_LABELS = {
  emergency: "Emergency", urgent: "Urgent", routine: "Routine", self_care: "Self-care",
};

function timeAgo(iso) {
  if (!iso) return "no checks yet";
  const then = new Date(iso + (iso.endsWith("Z") ? "" : "Z"));
  const days = Math.floor((Date.now() - then.getTime()) / 864e5);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.doctorPatients().then(setPatients).catch((e) => setError(e.message));
  }, []);

  const list = patients ?? [];
  const attention = list.filter((p) => p.needs_attention);
  const withAdh = list.filter((p) => p.adherence_pct != null);
  const avgAdh = withAdh.length
    ? Math.round(withAdh.reduce((a, p) => a + p.adherence_pct, 0) / withAdh.length)
    : null;

  return (
    <section>
      <h2 className="page-title">Your patients</h2>
      <p className="page-sub">
        {patients ? `${list.length} patient${list.length === 1 ? "" : "s"} connected` : "Loading…"}
      </p>

      {error && <div className="card" style={{ color: "var(--emergency)" }}>{error}</div>}

      {/* Caseload snapshot */}
      {patients && list.length > 0 && (
        <div className="admin-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          <div className="card stat-card">
            <span className="mini-icon"><Users size={16} /></span>
            <div className="stat-num">{list.length}</div>
            <div className="med-dose">patients</div>
          </div>
          <div className={`card stat-card ${attention.length ? "stat-alert" : ""}`}>
            <span className="mini-icon"><AlertTriangle size={16} /></span>
            <div className="stat-num">{attention.length}</div>
            <div className="med-dose">need attention</div>
          </div>
          <div className="card stat-card">
            <span className="mini-icon"><TrendingUp size={16} /></span>
            <div className="stat-num">{avgAdh == null ? "—" : `${avgAdh}%`}</div>
            <div className="med-dose">avg. adherence</div>
          </div>
        </div>
      )}

      {patients && list.length === 0 && (
        <div className="empty">
          <Users size={28} style={{ opacity: 0.5, marginBottom: "0.5rem" }} /><br />
          No patients yet. Patients can add you from their profile — share your name so they can find you.
        </div>
      )}

      {/* Priority inbox — server returns most-pressing first. */}
      {attention.length > 0 && (
        <div className="section-head"><h2 style={{ color: "var(--emergency)" }}>Needs attention</h2></div>
      )}
      {list.map((p, i) => {
        const firstRoutine = attention.length > 0 && i === attention.length;
        return (
          <div key={p.id}>
            {firstRoutine && <div className="section-head"><h2>All patients</h2></div>}
            <button
              className={`card activity-row ${p.needs_attention ? "patient-flag" : ""}`}
              onClick={() => navigate(`/doctor/patients/${p.id}`)}
            >
              <span className="avatar-sm">{p.name?.[0]?.toUpperCase() ?? "P"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="med-name">{p.name}</div>
                <div className="med-dose">
                  {[p.age && `${p.age}y`, p.sex, `${p.check_count} check${p.check_count === 1 ? "" : "s"}`]
                    .filter(Boolean).join(" · ")}
                </div>
                <div className="patient-meta">
                  <span>Last check: {timeAgo(p.last_check_at)}</span>
                  {p.reminder_count > 0 && (
                    <span><Pill size={12} /> {p.reminder_count}
                      {p.adherence_pct != null && ` · ${p.adherence_pct}% taken`}</span>
                  )}
                </div>
              </div>
              {p.last_urgency && <span className={`badge ${p.last_urgency}`}>{URGENCY_LABELS[p.last_urgency]}</span>}
              <ChevronRight size={18} color="var(--muted)" />
            </button>
          </div>
        );
      })}
    </section>
  );
}
