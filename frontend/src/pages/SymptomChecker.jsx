import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, Flame, Mic, Send } from "lucide-react";
import { api } from "../api.js";

const QUICK = ["Fever", "Cough", "Headache", "Nausea", "Fatigue", "Dizziness"];
const DURATIONS = ["Today", "1–2 days", "3–6 days", "A week or more"];
const URGENCY_LABELS = {
  emergency: "Emergency",
  urgent: "Urgent",
  routine: "Routine",
  self_care: "Self-care",
};

export default function SymptomChecker() {
  const [selected, setSelected] = useState([]);
  const [pain, setPain] = useState(0);
  const [duration, setDuration] = useState(DURATIONS[0]);
  const [details, setDetails] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const navigate = useNavigate();

  function toggle(symptom) {
    setSelected((s) =>
      s.includes(symptom) ? s.filter((x) => x !== symptom) : [...s, symptom]
    );
  }

  function composeText() {
    // Tags + free text feed keyword matching / the LLM. Pain and duration are
    // sent as structured fields so the engine can score them numerically.
    const parts = [];
    if (selected.length) parts.push(selected.join(", ").toLowerCase());
    if (details.trim()) parts.push(details.trim());
    return parts.join(". ").trim();
  }

  function toggleVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setError("Voice input isn't supported in this browser.");
      return;
    }
    if (recording) {
      recognitionRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const transcript = Array.from(e.results).map((r) => r[0].transcript).join(" ");
      setDetails((d) => (d ? `${d} ${transcript}` : transcript));
    };
    rec.onend = () => setRecording(false);
    rec.onerror = () => setRecording(false);
    recognitionRef.current = rec;
    setRecording(true);
    rec.start();
  }

  async function submit() {
    if (!selected.length && !details.trim()) {
      setError("Add a symptom or describe how you feel.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.triage({
        symptom_text: composeText(),
        pain_level: pain,
        duration,
      });
      setResult(data);
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
      <h2 className="page-title">Symptom check</h2>
      <p className="page-sub">Describe how you feel — we'll suggest the right level of care, never a diagnosis.</p>

      <div className="card">
        <h2>Quick select</h2>
        <div className="chips">
          {QUICK.map((s) => (
            <button
              key={s}
              className={`chip ${selected.includes(s) ? "on" : ""}`}
              onClick={() => toggle(s)}
              type="button"
            >
              {selected.includes(s) ? "✓" : "+"} {s}
            </button>
          ))}
        </div>

        <div className="divider" />

        <div className="controls">
          <div>
            <div className="label-row"><Flame size={16} className="accent" /> Pain Level: {pain}</div>
            <input type="range" min="0" max="10" value={pain} onChange={(e) => setPain(Number(e.target.value))} />
            <div className="range-scale"><span>0</span><span>10</span></div>
          </div>
          <div>
            <div className="label-row"><Calendar size={16} className="ink" /> Duration</div>
            <select className="field" value={duration} onChange={(e) => setDuration(e.target.value)} style={{ marginTop: "0.9rem" }}>
              {DURATIONS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
        </div>

        <div className="divider" />

        <h2>Describe details</h2>
        <div className="composer">
          <textarea
            placeholder="E.g., Woke up with a sore throat…"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
          <div className="composer-actions">
            <button
              type="button"
              className={`icon-btn ${recording ? "recording" : ""}`}
              onClick={toggleVoice}
              aria-label="Voice input"
            >
              <Mic size={18} />
            </button>
            <button
              type="button"
              className="icon-btn primary"
              onClick={submit}
              disabled={loading}
              aria-label="Get guidance"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>

      {error && <div className="card" style={{ color: "var(--emergency)" }}>{error}</div>}

      {result && (
        <div className={`card result ${result.urgency}`}>
          <div className="row" style={{ marginBottom: "0.5rem" }}>
            <strong style={{ fontSize: "1.02rem" }}>{result.headline}</strong>
            <span className={`badge ${result.urgency}`}>{URGENCY_LABELS[result.urgency] ?? result.urgency}</span>
          </div>
          <p>{result.guidance}</p>
          {result.red_flags.length > 0 && (
            <p className="muted"><strong>Why:</strong> {result.red_flags.join(", ")}</p>
          )}
          <p style={{ color: "var(--ink)", fontWeight: 600 }}>→ {result.recommended_action}</p>
          <p className="disclaimer">{result.disclaimer}</p>
        </div>
      )}
    </section>
  );
}
