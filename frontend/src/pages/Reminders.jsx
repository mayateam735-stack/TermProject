import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Bell, Calendar, Check, ChevronRight, Clock, Flame, Plus, Trophy, X } from "lucide-react";
import { api } from "../api.js";
import AdherenceRing from "../components/AdherenceRing.jsx";
import { currentSubscription, disableNotifications, enableNotifications, pushSupported } from "../push.js";

function fmt(t) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = ((h + 11) % 12) + 1;
  return `${String(hr).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtDate(iso) {
  const [, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

export default function Reminders() {
  const navigate = useNavigate();
  const [reminders, setReminders] = useState([]);
  const [adh, setAdh] = useState(null);
  const [streak, setStreak] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ medication: "", dosage: "", time_of_day: "08:00", start_date: todayStr() });
  const [error, setError] = useState(null);
  const [suggests, setSuggests] = useState([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const medTimer = useRef();

  function onMedChange(e) {
    const v = e.target.value;
    setForm((f) => ({ ...f, medication: v }));
    clearTimeout(medTimer.current);
    if (v.trim().length < 2) { setSuggests([]); setSuggestOpen(false); return; }
    medTimer.current = setTimeout(async () => {
      try {
        const r = await api.searchMedications(v.trim());
        setSuggests(r.results || []);
        setSuggestOpen(true);
      } catch {
        setSuggests([]);
      }
    }, 250);
  }

  function pickMed(name) {
    setForm((f) => ({ ...f, medication: name }));
    setSuggests([]);
    setSuggestOpen(false);
  }

  const [notif, setNotif] = useState("checking"); // checking | on | off | unsupported
  const [notifMsg, setNotifMsg] = useState(null);

  function load() {
    api.listReminders().then(setReminders).catch((e) => setError(e.message));
    api.adherence(0).then(setAdh).catch(() => setAdh(null));
    api.adherenceStreak().then(setStreak).catch(() => setStreak(null));
  }
  useEffect(load, []);

  useEffect(() => {
    if (!pushSupported()) { setNotif("unsupported"); return; }
    currentSubscription().then((s) => setNotif(s ? "on" : "off")).catch(() => setNotif("off"));
  }, []);

  async function enableNotif() {
    setNotifMsg(null);
    try { await enableNotifications(); setNotif("on"); setNotifMsg("Notifications on."); }
    catch (e) { setNotifMsg(e.message); }
  }
  async function disableNotif() {
    try { await disableNotifications(); setNotif("off"); setNotifMsg(null); }
    catch (e) { setNotifMsg(e.message); }
  }
  async function testNotif() {
    setNotifMsg("Sending…");
    try { const r = await api.pushTest(); setNotifMsg(r.sent ? "Test sent — check your notifications." : "No devices to notify."); }
    catch (e) { setNotifMsg(e.message); }
  }

  async function add(e) {
    e.preventDefault();
    setError(null);
    try {
      await api.createReminder(form);
      setForm({ medication: "", dosage: "", time_of_day: "08:00", start_date: todayStr() });
      setAdding(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const remove = async (id) => { await api.deleteReminder(id); load(); };
  const toggleTaken = async (r) => {
    try { await api.setReminderTaken(r.id, r.today_status !== "taken"); load(); }
    catch (err) { setError(err.message); }
  };
  const skip = async (r) => {
    try { await api.skipReminder(r.id); load(); }
    catch (err) { setError(err.message); }
  };

  return (
    <section>
      {/* Reminder notifications */}
      {notif !== "unsupported" && (
        <div className="card">
          <div className="row">
            <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
              <span className="settings-icon"><Bell size={18} /></span>
              <div>
                <div className="med-name" style={{ fontSize: "0.95rem" }}>Reminder notifications</div>
                <div className="med-dose">
                  {notif === "on" ? "On — you'll be pinged at dose times" : "Get a push when a dose is due"}
                </div>
              </div>
            </div>
            {notif === "on" ? (
              <div className="med-actions">
                <button className="link-skip on" onClick={testNotif}>Test</button>
                <button className="link-danger" onClick={disableNotif}>Turn off</button>
              </div>
            ) : (
              <button className="pill-action" style={{ flex: "0 0 auto" }} onClick={enableNotif}>Turn on</button>
            )}
          </div>
          {notifMsg && <p className="muted" style={{ margin: "0.6rem 0 0", fontSize: "0.8rem" }}>{notifMsg}</p>}
        </div>
      )}

      {/* Adherence streak — a lightweight motivation stat. */}
      {streak?.has_meds && (
        <div className="card streak-card">
          <div className={`streak-flame ${streak.current_streak > 0 ? "lit" : ""}`}>
            <Flame size={26} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="streak-num">
              {streak.current_streak}<span className="streak-unit">day{streak.current_streak === 1 ? "" : "s"}</span>
            </div>
            <div className="med-dose">
              {streak.current_streak === 0
                ? "Take every dose today to start a streak"
                : streak.today_complete
                  ? "All caught up today — keep it going!"
                  : "Finish today's doses to extend it"}
            </div>
          </div>
          {streak.best_streak > 0 && (
            <div className="streak-best">
              <Trophy size={14} /> Best {streak.best_streak}
            </div>
          )}
        </div>
      )}

      {/* Adherence summary card (clickable -> weekly detail) */}
      {adh && adh.scheduled > 0 && (
        <button className="card adherence-card" onClick={() => navigate("/meds/adherence")}>
          <div className="row" style={{ marginBottom: "0.6rem" }}>
            <strong style={{ fontSize: "1rem" }}>Medication adherence</strong>
            <ChevronRight size={18} color="var(--muted)" />
          </div>
          <div className="adherence-summary">
            <AdherenceRing pct={adh.adherence_pct} size={104} stroke={11} />
            <div className="adherence-legend">
              <div><Check size={16} color="var(--primary)" /> Taken <b>{adh.taken}</b></div>
              <div><X size={16} color="var(--urgent)" /> Skipped <b>{adh.skipped}</b></div>
              <div><AlertCircle size={16} color="var(--emergency)" /> Missed <b>{adh.missed}</b></div>
            </div>
          </div>
          <p className="muted" style={{ margin: "0.7rem 0 0", fontSize: "0.82rem", textAlign: "left" }}>
            {adh.message}
          </p>
        </button>
      )}

      <div className="section-head">
        <h2>Daily Reminders</h2>
        <button className="add-btn" onClick={() => setAdding((a) => !a)} aria-label="Add reminder">
          {adding ? <X size={20} /> : <Plus size={20} />}
        </button>
      </div>

      {adding && (
        <form className="card form-grid" onSubmit={add}>
          <div className="autocomplete">
            <input placeholder="Medication (e.g. Amoxicillin)" value={form.medication}
              onChange={onMedChange} autoComplete="off"
              onFocus={() => suggests.length && setSuggestOpen(true)}
              onBlur={() => setTimeout(() => setSuggestOpen(false), 150)} required />
            {suggestOpen && suggests.length > 0 && (
              <ul className="suggest-list">
                {suggests.map((s) => (
                  <li key={s} className="suggest-item" onMouseDown={() => pickMed(s)}>{s}</li>
                ))}
              </ul>
            )}
          </div>
          <input placeholder="Dosage (e.g. 500 mg)" value={form.dosage}
            onChange={(e) => setForm({ ...form, dosage: e.target.value })} />
          <div className="field-inline">
            <label className="field-inline-label"><Clock size={14} /> Time</label>
            <input type="time" value={form.time_of_day}
              onChange={(e) => setForm({ ...form, time_of_day: e.target.value })} required />
          </div>
          <div className="field-inline">
            <label className="field-inline-label"><Calendar size={14} /> Start date</label>
            <input type="date" value={form.start_date} min={todayStr()}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })} required />
          </div>
          <button className="btn" type="submit">Add reminder</button>
        </form>
      )}

      {error && <div className="card" style={{ color: "var(--emergency)" }}>{error}</div>}

      {reminders.length === 0 && !adding && (
        <div className="empty">No reminders yet. Tap + to add your first one.</div>
      )}

      {reminders.map((r) => {
        const taken = r.today_status === "taken";
        const skipped = r.today_status === "skipped";
        const notStarted = r.start_date && r.start_date > todayStr();
        return (
          <div className={`card med-card ${taken ? "done" : ""}`} key={r.id}>
            <button className={`check ${taken ? "done" : ""}`} onClick={() => toggleTaken(r)}
              aria-label={taken ? "Mark not taken" : "Mark taken"}>
              {taken && <Check size={18} />}
            </button>
            <button className="med-open" onClick={() => navigate(`/meds/${r.id}`)}
              title="View medication details">
              <div className="med-name">{r.medication}</div>
              <div className="med-dose">
                {r.dosage || "—"}
                {r.start_date && (
                  <span className={notStarted ? "start-tag" : "skip-tag"}>
                    {" · "}{notStarted ? "starts" : "from"} {fmtDate(r.start_date)}
                  </span>
                )}
                {skipped && <span className="skip-tag"> · skipped today</span>}
              </div>
            </button>
            <div style={{ textAlign: "right" }}>
              <div className="time-pill"><Clock size={14} /> {fmt(r.time_of_day)}</div>
              <div className="med-actions">
                <button className={`link-skip ${skipped ? "on" : ""}`} onClick={() => skip(r)}>
                  {skipped ? "Skipped" : "Skip"}
                </button>
                <button className="link-danger" onClick={() => remove(r.id)}>Remove</button>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
