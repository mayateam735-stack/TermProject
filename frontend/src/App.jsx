import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { Activity, Bell, HeartPulse, MapPin, Pill, User } from "lucide-react";
import SymptomChecker from "./pages/SymptomChecker.jsx";
import Locator from "./pages/Locator.jsx";
import Reminders from "./pages/Reminders.jsx";
import Profile from "./pages/Profile.jsx";

const tabClass = ({ isActive }) => (isActive ? "active" : "");

const TABS = [
  { to: "/triage", label: "Triage", Icon: Activity },
  { to: "/nearby", label: "Nearby", Icon: MapPin },
  { to: "/meds", label: "Meds", Icon: Pill },
  { to: "/profile", label: "Profile", Icon: User },
];

export default function App() {
  return (
    <div className="shell">
      <header className="appbar">
        <div className="brand">
          <span className="logo"><HeartPulse size={22} /></span>
          <div>
            <h1>HealthNav</h1>
            <p>How are you feeling today?</p>
          </div>
        </div>
        <button className="bell" aria-label="Notifications">
          <Bell size={18} />
          <span className="dot" />
        </button>
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/triage" replace />} />
          <Route path="/triage" element={<SymptomChecker />} />
          <Route path="/nearby" element={<Locator />} />
          <Route path="/meds" element={<Reminders />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </main>

      <nav className="tabbar">
        {TABS.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} className={tabClass}>
            <span className="tab-icon"><Icon size={22} /></span>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
