import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { api } from "../api.js";
import AdherenceRing from "../components/AdherenceRing.jsx";

export default function Adherence() {
  const navigate = useNavigate();
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState(null);

  useEffect(() => {
    api.adherence(offset).then(setData).catch(() => setData(null));
  }, [offset]);

  return (
    <section>
      <button className="back-link" onClick={() => navigate("/meds")}>
        <ArrowLeft size={16} /> Reminders
      </button>
      <h2 className="page-title">Weekly adherence</h2>

      {/* Week switcher */}
      <div className="week-switch">
        <button onClick={() => setOffset((o) => o - 1)} aria-label="Previous week"><ChevronLeft size={20} /></button>
        <span className="week-pill">{data?.range_label ?? "…"}</span>
        <button onClick={() => setOffset((o) => Math.min(0, o + 1))} disabled={offset >= 0} aria-label="Next week">
          <ChevronRight size={20} />
        </button>
      </div>

      {!data ? (
        <div className="card skeleton-row" />
      ) : data.scheduled === 0 ? (
        <div className="empty">No scheduled medications this week.</div>
      ) : (
        <>
          {/* Overall */}
          <div className="card">
            <h2>Overall medication adherence</h2>
            <div className="adherence-summary" style={{ marginTop: "0.6rem" }}>
              <AdherenceRing pct={data.adherence_pct} size={132} stroke={13} />
              <div className="adherence-legend">
                <div><Check size={16} color="var(--primary)" /> Taken <b>{data.taken}</b></div>
                <div><X size={16} color="var(--urgent)" /> Skipped <b>{data.skipped}</b></div>
                <div><AlertCircle size={16} color="var(--emergency)" /> Missed <b>{data.missed}</b></div>
              </div>
            </div>
            <div className="divider" />
            <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>{data.message}</p>
          </div>

          {/* Daily */}
          <div className="card">
            <h2>Daily adherence</h2>
            <div className="report-grid" style={{ marginBottom: "1rem" }}>
              <div className="report-stat">
                <div className="report-label">Weekday avg.</div>
                <div className="report-value" style={{ fontSize: "1.6rem" }}>{data.weekday_avg}%</div>
              </div>
              <div className="report-divider" />
              <div className="report-stat">
                <div className="report-label">Weekend avg.</div>
                <div className="report-value" style={{ fontSize: "1.6rem" }}>{data.weekend_avg}%</div>
              </div>
            </div>
            <div className="day-bars">
              {data.days.map((d, i) => (
                <div className="day-bar" key={i}>
                  <div className="day-bar-track">
                    <div className="day-bar-fill" style={{
                      height: `${d.scheduled ? Math.max(6, d.pct) : 0}%`,
                      background: d.pct >= 100 ? "var(--self_care)" : d.pct > 0 ? "var(--primary)" : "var(--line)",
                    }} />
                  </div>
                  <span className="day-bar-label" style={{ color: i === 0 ? "var(--emergency)" : "var(--muted)" }}>
                    {d.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* By time of day */}
          <div className="card">
            <h2>Adherence by time of day</h2>
            {data.buckets.map((b) => (
              <div className="tod-row" key={b.key}>
                <div className="row" style={{ marginBottom: "0.3rem" }}>
                  <strong style={{ fontSize: "0.9rem" }}>{b.label}</strong>
                  <span className="muted" style={{ fontSize: "0.78rem" }}>{b.scheduled} scheduled</span>
                </div>
                <div className="tod-track">
                  <div className="tod-fill" style={{ width: `${b.pct}%` }} />
                  {b.scheduled > 0 && <span className="tod-pct">{b.pct}%</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
