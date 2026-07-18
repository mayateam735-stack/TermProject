import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { api } from "../api.js";

const URGENCY_LABELS = {
  emergency: "Emergency", urgent: "Urgent", routine: "Routine", self_care: "Self-care",
};

export default function DoctorPatient() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.doctorPatient(id).then(setPatient).catch((e) => setError(e.message));
    api.doctorPatientHistory(id).then(setHistory).catch(() => setHistory([]));
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
