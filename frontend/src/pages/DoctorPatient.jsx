import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pill } from "lucide-react";
import { api } from "../api.js";

const URGENCY_LABELS = {
  emergency: "Emergency", urgent: "Urgent", routine: "Routine", self_care: "Self-care",
};
const ACTIVITY = { 1: "Sedentary", 2: "Light", 3: "Active", 4: "Very active" };

function fmtTime(t) {
  const [h, m] = (t || "").split(":").map(Number);
  if (Number.isNaN(h)) return t;
  const ampm = h >= 12 ? "PM" : "AM";
  return `${String(((h + 11) % 12) + 1).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}

function Vital({ label, value }) {
  return (
    <div className="vital">
      <div className="vital-value">{value ?? "—"}</div>
      <div className="vital-label">{label}</div>
    </div>
  );
}

export default function DoctorPatient() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [history, setHistory] = useState(null);
  const [meds, setMeds] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.doctorPatient(id).then(setPatient).catch((e) => setError(e.message));
    api.doctorPatientHistory(id).then(setHistory).catch(() => setHistory([]));
    api.doctorPatientMeds(id).then(setMeds).catch(() => setMeds([]));
  }, [id]);

  return (
    <section>
      <button className="back-link" onClick={() => navigate("/doctor")}>
        <ArrowLeft size={16} /> Patients
      </button>

      {patient && (
        <div className="card" style={{ display: "flex", alignItems: "center", gap: "0.9rem" }}>
          <span className="avatar">{patient.name?.[0]?.toUpperCase() ?? "P"}</span>
          <div>
            <div className="med-name">{patient.name}</div>
            <div className="med-dose">
              {[patient.age && `${patient.age}y`, patient.sex].filter(Boolean).join(" · ") || "—"}
            </div>
            {patient.conditions && (
              <div className="muted" style={{ fontSize: "0.8rem", marginTop: "0.2rem" }}>
                Conditions: {patient.conditions}
              </div>
            )}
          </div>
        </div>
      )}

      {error && <div className="card" style={{ color: "var(--emergency)" }}>{error}</div>}

      {/* Vitals at a glance */}
      {patient && (
        <div className="card">
          <h2>Vitals</h2>
          <div className="vital-grid">
            <Vital label="Height" value={patient.height_cm ? `${patient.height_cm} cm` : null} />
            <Vital label="Weight" value={patient.weight_kg ? `${patient.weight_kg} kg` : null} />
            <Vital label="DOB" value={patient.date_of_birth} />
            <Vital label="Activity" value={ACTIVITY[patient.activity_level]} />
          </div>
        </div>
      )}

      {/* Medications + adherence */}
      <div className="card">
        <h2>Medications</h2>
        {meds === null ? (
          <div className="skeleton-row" />
        ) : meds.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No medications on file.</p>
        ) : (
          meds.map((m) => (
            <div className="tod-row" key={m.id}>
              <div className="row" style={{ marginBottom: "0.3rem" }}>
                <strong style={{ fontSize: "0.9rem" }}>
                  <Pill size={13} style={{ verticalAlign: "-2px", marginRight: "0.3rem", color: "var(--primary)" }} />
                  {m.medication}
                </strong>
                <span className="muted" style={{ fontSize: "0.78rem" }}>
                  {[m.dosage, fmtTime(m.time_of_day)].filter(Boolean).join(" · ")}
                </span>
              </div>
              <div className="tod-track">
                <div className="tod-fill" style={{
                  width: `${m.adherence_pct ?? 0}%`,
                  background: (m.adherence_pct ?? 0) >= 80 ? "var(--self_care)" : "var(--urgent)",
                }} />
                {m.adherence_pct != null && <span className="tod-pct">{m.adherence_pct}%</span>}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="section-head"><h2>Symptom-check history</h2></div>

      {history === null ? (
        <div className="card skeleton-row" />
      ) : history.length === 0 ? (
        <div className="empty">No symptom checks recorded.</div>
      ) : (
        history.map((c) => (
          <div className={`card result ${c.urgency}`} key={c.id}>
            <div className="row" style={{ marginBottom: "0.4rem" }}>
              <strong style={{ fontSize: "0.95rem" }}>{c.symptom_text}</strong>
              <span className={`badge ${c.urgency}`}>{URGENCY_LABELS[c.urgency] ?? c.urgency}</span>
            </div>
            <p style={{ margin: "0 0 0.4rem" }}>{c.guidance}</p>
            {c.red_flags && <p className="muted" style={{ margin: "0 0 0.3rem" }}><strong>Why:</strong> {c.red_flags}</p>}
            <div className="med-dose">
              {new Date(c.created_at + (c.created_at.endsWith("Z") ? "" : "Z")).toLocaleString()}
            </div>
          </div>
        ))
      )}
    </section>
  );
}
