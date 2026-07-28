import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, User } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { useToast } from "../toast.jsx";
import { AVATAR_KEYS, avatarGradient } from "../avatars.js";

const ACTIVITY = [
  { level: 1, label: "Sedentary" },
  { level: 2, label: "Light" },
  { level: 3, label: "Active" },
  { level: 4, label: "Very active" },
];

export default function EditProfile() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({
    name: user?.name ?? "",
    avatar: user?.avatar ?? "mint",
    sex: user?.sex ?? "",
    height_cm: user?.height_cm ?? "",
    weight_kg: user?.weight_kg ?? "",
    date_of_birth: user?.date_of_birth ?? "",
    activity_level: user?.activity_level ?? null,
    doctor_id: user?.doctor_id ?? "",
  });
  const [doctors, setDoctors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.listDoctors().then(setDoctors).catch(() => setDoctors([]));
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateMe({
        name: form.name,
        avatar: form.avatar,
        sex: form.sex || null,
        height_cm: form.height_cm ? Number(form.height_cm) : null,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
        date_of_birth: form.date_of_birth || null,
        activity_level: form.activity_level ?? null,
        doctor_id: form.doctor_id ? Number(form.doctor_id) : null,
      });
      setUser(updated);
      toast("Profile updated");
      navigate("/profile", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section style={{ paddingBottom: "4rem" }}>
      <button className="back-link" onClick={() => navigate("/profile")}>
        <ArrowLeft size={16} /> My page
      </button>
      <h2 className="page-title">Edit profile</h2>

      {/* Avatar picker */}
      <div className="card" style={{ textAlign: "center" }}>
        <div className="avatar-xl" style={{ background: avatarGradient(form.avatar) }}>
          <User size={40} color="#ffffff" />
        </div>
        <div className="avatar-row">
          {AVATAR_KEYS.map((key) => (
            <button
              key={key}
              className={`avatar-choice ${form.avatar === key ? "on" : ""}`}
              style={{ background: avatarGradient(key) }}
              onClick={() => setForm({ ...form, avatar: key })}
              aria-label={`Avatar ${key}`}
            >
              {form.avatar === key && <Check size={16} color="#fff" />}
            </button>
          ))}
        </div>
      </div>

      {/* Name */}
      <div className="card">
        <label className="field-label">Name</label>
        <input className="line-input" value={form.name} onChange={set("name")} placeholder="Your name" />
      </div>

      {/* Vitals */}
      <div className="card">
        <div className="field-line">
          <span className="field-label">Gender</span>
          <select className="line-select" value={form.sex} onChange={set("sex")}>
            <option value="">—</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="field-line">
          <span className="field-label">Height</span>
          <span className="line-inline">
            <input className="line-input sm" type="number" min="30" max="280" value={form.height_cm} onChange={set("height_cm")} placeholder="—" />
            <span className="unit">cm</span>
          </span>
        </div>
        <div className="field-line">
          <span className="field-label">Weight</span>
          <span className="line-inline">
            <input className="line-input sm" type="number" min="1" max="500" value={form.weight_kg} onChange={set("weight_kg")} placeholder="—" />
            <span className="unit">kg</span>
          </span>
        </div>
        <div className="field-line" style={{ borderBottom: "none" }}>
          <span className="field-label">Date of birth</span>
          <input className="line-input sm" type="date" value={form.date_of_birth} onChange={set("date_of_birth")} />
        </div>
      </div>

      <p className="muted" style={{ fontSize: "0.82rem", lineHeight: 1.5, padding: "0 0.3rem" }}>
        Gender, height, weight, and date of birth help tailor your guidance. You don't have to
        provide this — but recommendations are more accurate if you do.
      </p>

      {/* Your doctor */}
      <div className="card">
        <div className="field-line" style={{ borderBottom: "none", padding: "0.2rem 0" }}>
          <span className="field-label">Your doctor</span>
          <select className="line-select" value={form.doctor_id} onChange={set("doctor_id")}>
            <option value="">None</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>Dr. {d.name}</option>
            ))}
          </select>
        </div>
        <p className="muted" style={{ fontSize: "0.78rem", margin: "0.4rem 0 0" }}>
          Your doctor can review your symptom-check history from their dashboard.
        </p>
      </div>

      {/* Activity level */}
      <div className="card">
        <h2>Activity level</h2>
        <div className="activity-row">
          {ACTIVITY.map((a) => (
            <button
              key={a.level}
              className={`activity-choice ${form.activity_level === a.level ? "on" : ""}`}
              onClick={() => setForm({ ...form, activity_level: a.level })}
            >
              <span className="activity-dot">{a.level}</span>
              <span className="activity-label">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <div className="card" style={{ color: "var(--emergency)" }}>{error}</div>}

      <div className="edit-actions">
        <button className="btn btn-ghost" onClick={() => navigate("/profile")}>Cancel</button>
        <button className="btn" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      </div>
    </section>
  );
}
