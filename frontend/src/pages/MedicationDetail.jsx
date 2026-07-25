import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Calendar, Check, Clock, Info, Repeat, Trash2, X } from "lucide-react";
import { api } from "../api.js";
import AdherenceRing from "../components/AdherenceRing.jsx";

function fmtTime(t) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "p.m." : "a.m.";
  const hr = ((h + 11) % 12) + 1;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function MedicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [med, setMed] = useState(null);
  const [info, setInfo] = useState(undefined); // undefined = loading, null = none
  const [error, setError] = useState(null);

  function load() {
    api.reminderDetail(id)
      .then((d) => {
        setMed(d);
        api.medicationInfo(d.medication).then((r) => setInfo(r.info)).catch(() => setInfo(null));
      })
      .catch((e) => setError(e.message));
  }
  useEffect(load, [id]);

  const act = async (fn) => { try { await fn(); load(); } catch (e) { setError(e.message); } };

  async function remove() {
    await api.deleteReminder(id);
    navigate("/meds", { replace: true });
  }

  if (error) return (
    <section>
      <button className="back-link" onClick={() => navigate("/meds")}><ArrowLeft size={16} /> Reminders</button>
      <div className="card" style={{ color: "var(--emergency)" }}>{error}</div>
    </section>
  );
  if (!med) return <section><div className="card skeleton-row" /></section>;

  const taken = med.today_status === "taken";
  const skipped = med.today_status === "skipped";

  return (
    <section>
      <button className="back-link" onClick={() => navigate("/meds")}>
        <ArrowLeft size={16} /> Reminders
      </button>
      <h2 className="page-title">{med.medication}</h2>
      <p className="page-sub">{med.dosage || "No dosage set"}</p>

      {/* Per-med adherence */}
      <div className="card">
        <h2>Adherence ({med.since_label})</h2>
        <div className="adherence-summary" style={{ marginTop: "0.5rem" }}>
          <AdherenceRing pct={med.adherence_pct} size={116} stroke={12} />
          <div className="adherence-legend">
            <div><Check size={16} color="var(--primary)" /> Taken <b>{med.taken}</b></div>
            <div><X size={16} color="var(--urgent)" /> Skipped <b>{med.skipped}</b></div>
            <div><AlertCircle size={16} color="var(--emergency)" /> Missed <b>{med.missed}</b></div>
          </div>
        </div>
      </div>

      {/* Today's action */}
      <div className="card">
        <h2>Today</h2>
        <div className="detail-actions">
          <button className={`pill-action ${taken ? "on" : ""}`} onClick={() => act(() => api.setReminderTaken(med.id, !taken))}>
            <Check size={16} /> {taken ? "Taken ✓" : "Mark taken"}
          </button>
          <button className={`pill-action warn ${skipped ? "on" : ""}`} onClick={() => act(() => api.skipReminder(med.id))}>
            <X size={16} /> {skipped ? "Skipped" : "Skip"}
          </button>
        </div>
      </div>

      {/* Schedule */}
      <div className="card">
        <h2>Schedule</h2>
        <div className="sched-row"><span className="mini-icon"><Repeat size={16} /></span> Every day</div>
        <div className="sched-row"><span className="mini-icon"><Clock size={16} /></span> {fmtTime(med.time_of_day)}{med.dosage ? `, ${med.dosage}` : ""}</div>
        <div className="sched-row"><span className="mini-icon"><Calendar size={16} /></span> Starting {med.since_label.replace(" to now", "")}</div>
      </div>

      {/* Drug information (from openFDA) */}
      <div className="card">
        <div className="row" style={{ marginBottom: "0.5rem" }}>
          <h2 style={{ margin: 0 }}>Information</h2>
          <Info size={16} color="var(--muted)" />
        </div>
        {info === undefined ? (
          <p className="muted" style={{ margin: 0 }}>Loading drug information…</p>
        ) : info ? (
          <>
            <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5, color: "var(--ink-soft)" }}>{info}</p>
            <p className="disclaimer" style={{ marginTop: "0.6rem" }}>Source: openFDA drug label. Educational info — not medical advice.</p>
          </>
        ) : (
          <p className="muted" style={{ margin: 0 }}>No drug information found for this medication.</p>
        )}
      </div>

      <button className="btn btn-outline" onClick={remove}>
        <Trash2 size={16} style={{ marginRight: "0.4rem", verticalAlign: "-3px" }} /> Delete reminder
      </button>
    </section>
  );
}
