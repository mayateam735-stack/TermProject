import { ChevronRight, FileText, HeartPulse, Shield, User } from "lucide-react";

const ITEMS = [
  { Icon: User, title: "Profile basics", sub: "Name, age, conditions" },
  { Icon: HeartPulse, title: "Health history", sub: "Past symptom checks & guidance" },
  { Icon: FileText, title: "Share with clinician", sub: "One-tap summary (with consent)" },
  { Icon: Shield, title: "Privacy & safety", sub: "Your data stays private" },
];

export default function Profile() {
  return (
    <section>
      <h2 className="page-title">Your profile</h2>
      <p className="page-sub">A private, persistent record of your health.</p>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {ITEMS.map(({ Icon, title, sub }, i) => (
          <div
            key={title}
            className="row"
            style={{
              padding: "1rem 1.1rem",
              borderBottom: i < ITEMS.length - 1 ? "1px solid var(--line)" : "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
              <span style={{
                width: 38, height: 38, borderRadius: 12, display: "grid", placeItems: "center",
                background: "var(--primary-soft)", color: "var(--primary)",
              }}>
                <Icon size={18} />
              </span>
              <div>
                <div className="med-name" style={{ fontSize: "0.92rem" }}>{title}</div>
                <div className="med-dose">{sub}</div>
              </div>
            </div>
            <ChevronRight size={18} color="var(--muted)" />
          </div>
        ))}
      </div>

      <p className="disclaimer" style={{ textAlign: "center" }}>
        Educational student project — not a medical device.
      </p>
    </section>
  );
}
