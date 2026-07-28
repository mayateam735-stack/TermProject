import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, Search } from "lucide-react";
import { api } from "../api.js";

const ROLE_CLS = { admin: "emergency", doctor: "urgent", patient: "self_care" };

export default function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    api.adminUsers().then(setUsers).catch((e) => setError(e.message));
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (users ?? []).filter((u) =>
      !t || u.name.toLowerCase().includes(t) || u.email.toLowerCase().includes(t) || u.role.includes(t)
    );
  }, [users, q]);

  return (
    <section>
      <button className="back-link" onClick={() => navigate("/admin")}>
        <ArrowLeft size={16} /> Overview
      </button>
      <h2 className="page-title">Manage users</h2>
      <p className="page-sub">{users ? `${users.length} accounts` : "Loading…"}</p>

      <div className="card" style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.7rem 0.9rem" }}>
        <Search size={16} color="var(--muted)" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, role"
          style={{ border: "none", outline: "none", background: "transparent", flex: 1, font: "inherit", color: "var(--ink)" }} />
      </div>

      {error && <div className="card" style={{ color: "var(--emergency)" }}>{error}</div>}

      {filtered.map((u) => (
        <button className="card activity-row" key={u.id} onClick={() => navigate(`/admin/users/${u.id}`)}>
          <span className="avatar-sm">{u.name?.[0]?.toUpperCase() ?? "U"}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="med-name">{u.name}</div>
            <div className="med-dose" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{u.email}</div>
            <div className="muted" style={{ fontSize: "0.75rem" }}>{u.checks} checks</div>
          </div>
          <span className={`badge ${ROLE_CLS[u.role] ?? "routine"}`}>{u.role}</span>
          <ChevronRight size={18} color="var(--muted)" />
        </button>
      ))}
    </section>
  );
}
