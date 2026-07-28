import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Trash2 } from "lucide-react";
import { api } from "../api.js";
import { useToast } from "../toast.jsx";

export default function AdminUserEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [note, setNote] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.adminUser(id).then(setForm).catch((e) => setNote(e.message));
    api.listDoctors().then(setDoctors).catch(() => setDoctors([]));
  }, [id]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save() {
    setSaving(true);
    setNote(null);
    try {
      const updated = await api.adminUpdateUser(id, {
        name: form.name,
        email: form.email,
        role: form.role,
        age: form.age === "" || form.age == null ? null : Number(form.age),
        sex: form.sex || null,
        conditions: form.conditions || null,
        height_cm: form.height_cm ? Number(form.height_cm) : null,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
        date_of_birth: form.date_of_birth || null,
        activity_level: form.activity_level ? Number(form.activity_level) : null,
        doctor_id: form.doctor_id ? Number(form.doctor_id) : null,
      });
      setForm(updated);
      toast("Changes saved");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete ${form.name}? This removes their history, reminders, and account.`)) return;
    try {
      await api.adminDeleteUser(id);
      navigate("/admin/users", { replace: true });
    } catch (e) {
      setNote(e.message);
    }
  }

  if (!form) return (
    <section>
      <button className="back-link" onClick={() => navigate("/admin/users")}><ArrowLeft size={16} /> Users</button>
      {note ? <div className="card" style={{ color: "var(--emergency)" }}>{note}</div> : <div className="card skeleton-row" />}
    </section>
  );

  return (
    <section>
      <button className="back-link" onClick={() => navigate("/admin/users")}>
        <ArrowLeft size={16} /> Users
      </button>
      <h2 className="page-title">Edit user</h2>
      <p className="page-sub">Joined {form.created_at?.slice(0, 10)}</p>

      {note && <div className="card note">{note}</div>}

      {/* Login & engagement */}
      <div className="card">
        <h2>Login &amp; activity</h2>
        <div className="row" style={{ marginBottom: "0.35rem" }}><span className="muted">Sign-ins</span><strong>{form.login_count ?? 0}</strong></div>
        <div className="row" style={{ marginBottom: "0.35rem" }}><span className="muted">App opens</span><strong>{form.app_opens ?? 0}</strong></div>
        <div className="row" style={{ marginBottom: "0.35rem" }}><span className="muted">Last login</span><strong>{form.last_login ? new Date(form.last_login + (form.last_login.endsWith("Z") ? "" : "Z")).toLocaleString() : "—"}</strong></div>
        <div className="row"><span className="muted">Checks / reminders</span><strong>{form.checks} / {form.reminders}</strong></div>
      </div>

      <div className="card">
        <label className="field-label">Name</label>
        <input className="line-input" value={form.name || ""} onChange={set("name")} />
        <label className="field-label" style={{ marginTop: "0.6rem" }}>Email</label>
        <input className="line-input" type="email" value={form.email || ""} onChange={set("email")} />
        <div className="field-line" style={{ marginTop: "0.4rem" }}>
          <span className="field-label">Role</span>
          <select className="line-select" value={form.role} onChange={set("role")}>
            <option value="patient">patient</option>
            <option value="doctor">doctor</option>
            <option value="admin">admin</option>
          </select>
        </div>
      </div>

      <div className="card">
        <div className="field-line">
          <span className="field-label">Gender</span>
          <select className="line-select" value={form.sex || ""} onChange={set("sex")}>
            <option value="">—</option><option value="female">Female</option>
            <option value="male">Male</option><option value="other">Other</option>
          </select>
        </div>
        <div className="field-line">
          <span className="field-label">Age</span>
          <input className="line-input sm" type="number" min="0" max="120" value={form.age ?? ""} onChange={set("age")} />
        </div>
        <div className="field-line">
          <span className="field-label">Height</span>
          <span className="line-inline"><input className="line-input sm" type="number" value={form.height_cm ?? ""} onChange={set("height_cm")} /><span className="unit">cm</span></span>
        </div>
        <div className="field-line">
          <span className="field-label">Weight</span>
          <span className="line-inline"><input className="line-input sm" type="number" value={form.weight_kg ?? ""} onChange={set("weight_kg")} /><span className="unit">kg</span></span>
        </div>
        <div className="field-line">
          <span className="field-label">Date of birth</span>
          <input className="line-input sm" type="date" value={form.date_of_birth || ""} onChange={set("date_of_birth")} />
        </div>
        <div className="field-line" style={{ borderBottom: "none" }}>
          <span className="field-label">Doctor</span>
          <select className="line-select" value={form.doctor_id || ""} onChange={set("doctor_id")}>
            <option value="">None</option>
            {doctors.map((d) => <option key={d.id} value={d.id}>Dr. {d.name}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        <label className="field-label">Conditions</label>
        <textarea className="line-input" rows={2} value={form.conditions || ""} onChange={set("conditions")} />
      </div>

      <div className="edit-actions">
        <button className="btn btn-ghost" onClick={() => navigate("/admin/users")}>Cancel</button>
        <button className="btn" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
      </div>
      <button className="btn btn-outline" onClick={remove}>
        <Trash2 size={16} style={{ marginRight: "0.4rem", verticalAlign: "-3px" }} /> Delete user
      </button>
    </section>
  );
}
