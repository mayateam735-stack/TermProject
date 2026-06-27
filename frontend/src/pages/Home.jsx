import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Check, Clock, MapPin, Phone, Pill, Siren, Stethoscope, User } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";

// "How can we help you?" quick actions. `to` navigates in-app; `href` is a
// real device action (tap-to-call). Each tile maps to a working destination.
const HELP_TILES = [
  { label: "Check Symptoms", Icon: Stethoscope, to: "/triage", variant: "primary" },
  { label: "Find Care Nearby", Icon: MapPin, to: "/nearby" },
  { label: "My Medications", Icon: Pill, to: "/meds" },
  { label: "Health Profile", Icon: User, to: "/profile" },
  { label: "Call HealthLink 8-1-1", Icon: Phone, href: "tel:811", variant: "accent" },
  { label: "Emergency 911", Icon: Siren, href: "tel:911", variant: "danger" },
];

function HelpTile({ label, Icon, to, href, variant, navigate }) {
  const cls = `help-tile ${variant ?? ""}`;
  const inner = (
    <>
      <span className="tile-icon"><Icon size={24} /></span>
      <span className="tile-label">{label}</span>
    </>
  );
  return href ? (
    <a className={cls} href={href}>{inner}</a>
  ) : (
    <button className={cls} onClick={() => navigate(to)}>{inner}</button>
  );
}

// Map the rule-engine urgency (4 bands) onto the dashboard's 3 outcome styles.
const OUTCOME_STYLES = {
  self: { label: "Self-care", cls: "self_care" },
  soon: { label: "See a doctor soon", cls: "urgent" },
  er: { label: "Go to the ER", cls: "emergency" },
};
const URGENCY_TO_OUTCOME = {
  self_care: "self",
  routine: "soon",
  urgent: "soon",
  emergency: "er",
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtTime(t) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${String(((h + 11) % 12) + 1).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}

function timeAgo(iso) {
  const then = new Date(iso + (iso.endsWith("Z") ? "" : "Z"));
  const mins = Math.round((Date.now() - then.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reminders, setReminders] = useState(null); // null = loading
  const [checks, setChecks] = useState(null);

  useEffect(() => {
    api.listReminders().then(setReminders).catch(() => setReminders([]));
    api.listSymptomChecks(5).then(setChecks).catch(() => setChecks([]));
  }, []);

  // "Upcoming" = reminders not yet taken today. We keep GET /api/reminders
  // returning everything (the Meds tab needs the full set + taken state) and
  // filter for the dashboard view here.
  const upcoming = (reminders ?? []).filter((r) => r.last_taken_date !== todayStr());

  async function markTaken(r) {
    const updated = await api.setReminderTaken(r.id, true);
    setReminders((list) => list.map((x) => (x.id === updated.id ? updated : x)));
  }

  return (
    <section>
      <h2 className="page-title">{greeting()}, {user?.name?.split(" ")[0]}</h2>
      <p className="page-sub">Here's your health at a glance.</p>

      {/* How can we help you? — quick-action grid. */}
      <div className="banner">How can we help you?</div>
      <div className="help-grid">
        {HELP_TILES.map((t) => (
          <HelpTile key={t.label} {...t} navigate={navigate} />
        ))}
      </div>

      {/* Upcoming reminders */}
      <div className="section-head">
        <h2>Upcoming</h2>
        <button className="link-more" onClick={() => navigate("/meds")}>Manage</button>
      </div>
      {reminders === null ? (
        <div className="card skeleton-row" />
      ) : upcoming.length === 0 ? (
        <div className="empty">No doses left for today — you're all caught up. 🎉</div>
      ) : (
        upcoming.map((r) => (
          <div className="card med-card" key={r.id}>
            <button className="check" onClick={() => markTaken(r)} aria-label="Mark taken">
              <Check size={18} style={{ opacity: 0 }} />
            </button>
            <span className="mini-icon"><Pill size={16} /></span>
            <div style={{ flex: 1 }}>
              <div className="med-name">{r.medication}</div>
              <div className="med-dose">{r.dosage || "—"}</div>
            </div>
            <div className="time-pill"><Clock size={14} /> {fmtTime(r.time_of_day)}</div>
          </div>
        ))
      )}

      {/* Recent activity */}
      <div className="section-head">
        <h2>Recent activity</h2>
      </div>
      {checks === null ? (
        <div className="card skeleton-row" />
      ) : checks.length === 0 ? (
        <div className="empty">No symptom checks yet. Tap “Check your symptoms” to start.</div>
      ) : (
        checks.map((c) => {
          const outcome = OUTCOME_STYLES[URGENCY_TO_OUTCOME[c.urgency]] ?? OUTCOME_STYLES.soon;
          return (
            <div className="card activity-row" key={c.id}>
              <span className="mini-icon"><Activity size={16} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="activity-text">{c.symptom_text}</div>
                <div className="med-dose">{timeAgo(c.created_at)}</div>
              </div>
              <span className={`badge ${outcome.cls}`}>{outcome.label}</span>
            </div>
          );
        })
      )}
    </section>
  );
}
