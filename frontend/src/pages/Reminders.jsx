import { useEffect, useState } from "react";
import { Check, Clock, Plus, X } from "lucide-react";
import { api } from "../api.js";

function fmt(t) {
  // "08:00" -> "08:00 AM"
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = ((h + 11) % 12) + 1;
  return `${String(hr).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function Reminders() {
  const [reminders, setReminders] = useState([]);
  const [taken, setTaken] = useState({}); // local "taken today" state
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ medication: "", dosage: "", time_of_day: "08:00" });
  const [error, setError] = useState(null);

  function load() {
    api.listReminders().then(setReminders).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  async function add(e) {
    e.preventDefault();
    setError(null);
    try {
      await api.createReminder(form);
      setForm({ medication: "", dosage: "", time_of_day: "08:00" });
      setAdding(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    await api.deleteReminder(id);
    load();
  }

  return (
    <section>
      <div className="section-head">
        <h2>Daily Reminders</h2>
        <button className="add-btn" onClick={() => setAdding((a) => !a)} aria-label="Add reminder">
          {adding ? <X size={20} /> : <Plus size={20} />}
        </button>
      </div>

      {adding && (
        <form className="card form-grid" onSubmit={add}>
          <input placeholder="Medication (e.g. Amoxicillin)" value={form.medication}
            onChange={(e) => setForm({ ...form, medication: e.target.value })} required />
          <input placeholder="Dosage (e.g. 500 mg)" value={form.dosage}
            onChange={(e) => setForm({ ...form, dosage: e.target.value })} />
          <input type="time" value={form.time_of_day}
            onChange={(e) => setForm({ ...form, time_of_day: e.target.value })} required />
          <button className="btn" type="submit">Add reminder</button>
        </form>
      )}

      {error && <div className="card" style={{ color: "var(--emergency)" }}>{error}</div>}

      {reminders.length === 0 && !adding && (
        <div className="empty">No reminders yet. Tap + to add your first one.</div>
      )}

      {reminders.map((r) => {
        const done = !!taken[r.id];
        return (
          <div className={`card med-card ${done ? "done" : ""}`} key={r.id}>
            <button
              className={`check ${done ? "done" : ""}`}
              onClick={() => setTaken((t) => ({ ...t, [r.id]: !t[r.id] }))}
              aria-label={done ? "Mark not taken" : "Mark taken"}
            >
              {done && <Check size={18} />}
            </button>
            <div style={{ flex: 1 }}>
              <div className="med-name">{r.medication}</div>
              <div className="med-dose">{r.dosage || "—"}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="time-pill"><Clock size={14} /> {fmt(r.time_of_day)}</div>
              <button className="link-danger" onClick={() => remove(r.id)}>Remove</button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
