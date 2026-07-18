import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Users } from "lucide-react";
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

  return (
    <section>
      <h2 className="page-title">Your patients</h2>
      <p className="page-sub">
        {patients ? `${patients.length} patient${patients.length === 1 ? "" : "s"} connected` : "Loading…"}
      </p>

      {error && <div className="card" style={{ color: "var(--emergency)" }}>{error}</div>}

      {patients && patients.length === 0 && (
        <div className="empty">
          <Users size={28} style={{ opacity: 0.5, marginBottom: "0.5rem" }} /><br />
          No patients yet. Patients can add you from their profile — share your name so they can find you.
        </div>
      )}

      {(patients ?? []).map((p) => (
        <button className="card activity-row" key={p.id} onClick={() => navigate(`/doctor/patients/${p.id}`)}>
          <span className="avatar-sm">{p.name?.[0]?.toUpperCase() ?? "P"}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="med-name">{p.name}</div>
            <div className="med-dose">
              {[p.age && `${p.age}y`, p.sex, `${p.check_count} check${p.check_count === 1 ? "" : "s"}`]
                .filter(Boolean).join(" · ")}
            </div>
            <div className="muted" style={{ fontSize: "0.76rem", marginTop: "0.15rem" }}>
              Last check: {timeAgo(p.last_check_at)}
            </div>
          </div>
          {p.last_urgency && <span className={`badge ${p.last_urgency}`}>{URGENCY_LABELS[p.last_urgency]}</span>}
          <ChevronRight size={18} color="var(--muted)" />
        </button>
      ))}
    </section>
  );
}
