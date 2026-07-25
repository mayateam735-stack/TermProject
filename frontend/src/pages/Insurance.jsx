import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Award } from "lucide-react";
import { api } from "../api.js";

const FIELDS = [
  { key: "prescriptions", label: "Prescriptions", hint: "medication you pay for / year" },
  { key: "dental", label: "Dental", hint: "cleanings, fillings / year" },
  { key: "vision", label: "Vision", hint: "glasses, exams / year" },
  { key: "paramedical", label: "Physio / massage / chiro", hint: "per year" },
];

const money = (n) => `$${Math.round(n).toLocaleString()}`;

export default function Insurance() {
  const navigate = useNavigate();
  const [usage, setUsage] = useState({ prescriptions: 600, dental: 400, vision: 200, paramedical: 300 });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const set = (k) => (e) => setUsage({ ...usage, [k]: e.target.value });

  async function compare() {
    setLoading(true);
    setError(null);
    try {
      const payload = Object.fromEntries(FIELDS.map((f) => [f.key, Number(usage[f.key]) || 0]));
      setResult(await api.insuranceEstimate(payload));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <button className="back-link" onClick={() => navigate("/home")}>
        <ArrowLeft size={16} /> Home
      </button>
      <h2 className="page-title">Insurance cost analysis</h2>
      <p className="page-sub">Estimate your yearly cost across plans based on how much care you expect to use.</p>

      <div className="card">
        <h2>Your expected spending (per year)</h2>
        {FIELDS.map((f) => (
          <div className="field-line" key={f.key}>
            <div>
              <div className="field-label">{f.label}</div>
              <div className="med-dose">{f.hint}</div>
            </div>
            <div className="line-inline">
              <span className="unit">$</span>
              <input className="line-input sm" type="number" min="0" value={usage[f.key]} onChange={set(f.key)} />
            </div>
          </div>
        ))}
        <button className="btn" onClick={compare} disabled={loading} style={{ marginTop: "1rem" }}>
          {loading ? "Comparing…" : "Compare plans"}
        </button>
      </div>

      {error && <div className="card" style={{ color: "var(--emergency)" }}>{error}</div>}

      {result && (
        <>
          <div className="section-head">
            <h2>Results</h2>
            <span className="muted" style={{ fontSize: "0.82rem" }}>Expected care: {money(result.total_expected_spend)}/yr</span>
          </div>
          {result.estimates.map((p) => {
            const best = p.id === result.best_id;
            return (
              <div className={`card ${best ? "result self_care" : ""}`} key={p.id}>
                <div className="row" style={{ marginBottom: "0.4rem" }}>
                  <strong style={{ fontSize: "1rem" }}>{p.name}</strong>
                  {best && <span className="badge self_care" style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}><Award size={12} /> Best value</span>}
                </div>
                <div className="row" style={{ alignItems: "flex-end" }}>
                  <div>
                    <div className="muted" style={{ fontSize: "0.78rem" }}>Estimated total / year</div>
                    <div className="report-value" style={{ fontSize: "1.7rem" }}>{money(p.estimated_annual_cost)}</div>
                  </div>
                  {p.id !== "none" && (
                    <div style={{ textAlign: "right" }}>
                      <div className={`delta ${p.savings_vs_none > 0 ? "up" : "down"}`}>
                        {p.savings_vs_none > 0 ? `Saves ${money(p.savings_vs_none)}` : `+${money(-p.savings_vs_none)} vs none`}
                      </div>
                    </div>
                  )}
                </div>
                <div className="divider" />
                <div className="row muted" style={{ fontSize: "0.82rem" }}>
                  <span>Premiums: {money(p.annual_premium)}/yr</span>
                  <span>You still pay: {money(p.out_of_pocket)}</span>
                </div>
              </div>
            );
          })}
          <p className="disclaimer" style={{ textAlign: "center" }}>
            Illustrative sample plans for comparison — not real quotes or advice. Actual coverage varies.
          </p>
        </>
      )}
    </section>
  );
}
