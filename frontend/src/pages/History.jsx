import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { api } from "../api.js";

const URGENCY_LABELS = {
  emergency: "Emergency",
  urgent: "Urgent",
  routine: "Routine",
  self_care: "Self-care",
};

export default function History() {
  const navigate = useNavigate();
  const [checks, setChecks] = useState(null);

  useEffect(() => {
    api.history(50).then(setChecks).catch(() => setChecks([]));
  }, []);

  return (
    <section>
      <button className="back-link" onClick={() => navigate("/profile")}>
        <ArrowLeft size={16} /> Profile
      </button>
      <h2 className="page-title">Health history</h2>
      <p className="page-sub">Your past symptom checks and the guidance you received.</p>

      {checks === null ? (
        <div className="card skeleton-row" />
      ) : checks.length === 0 ? (
        <div className="empty">No symptom checks yet.</div>
      ) : (
        checks.map((c) => (
          <div className={`card result ${c.urgency}`} key={c.id}>
            <div className="row" style={{ marginBottom: "0.4rem" }}>
              <strong style={{ fontSize: "0.95rem" }}>{c.symptom_text}</strong>
              <span className={`badge ${c.urgency}`}>{URGENCY_LABELS[c.urgency] ?? c.urgency}</span>
            </div>
            <p style={{ margin: "0 0 0.4rem" }}>{c.guidance}</p>
            {c.red_flags && <p className="muted" style={{ margin: "0 0 0.3rem" }}><strong>Why:</strong> {c.red_flags}</p>}
            <div className="med-dose">{new Date(c.created_at + (c.created_at.endsWith("Z") ? "" : "Z")).toLocaleString()}</div>
          </div>
        ))
      )}
    </section>
  );
}
