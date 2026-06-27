import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Bot, Home as HomeIcon, HeartPulse, LogOut, MapPin, Pill, User } from "lucide-react";
import { useAuth } from "./auth.jsx";
import Home from "./pages/Home.jsx";
import SymptomChecker from "./pages/SymptomChecker.jsx";
import Locator from "./pages/Locator.jsx";
import Reminders from "./pages/Reminders.jsx";
import Profile from "./pages/Profile.jsx";
import History from "./pages/History.jsx";
import Chat from "./pages/Chat.jsx";
import SignUp from "./pages/SignUp.jsx";
import SignIn from "./pages/SignIn.jsx";

const tabClass = ({ isActive }) => (isActive ? "active" : "");

const TABS = [
  { to: "/home", label: "Home", Icon: HomeIcon },
  { to: "/nearby", label: "Nearby", Icon: MapPin },
  { to: "/meds", label: "Meds", Icon: Pill },
  { to: "/profile", label: "Profile", Icon: User },
];

function Splash() {
  return (
    <div className="shell">
      <div className="auth-screen">
        <span className="logo logo-lg"><HeartPulse size={34} /></span>
        <p className="muted" style={{ marginTop: "1rem" }}>Loading…</p>
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading) return <Splash />;

  // Logged out — only the auth screens are reachable; default to Sign Up.
  if (!user) {
    return (
      <Routes>
        <Route path="/signup" element={<SignUp />} />
        <Route path="/login" element={<SignIn />} />
        <Route path="*" element={<Navigate to="/signup" replace />} />
      </Routes>
    );
  }

  // Logged in — the full app shell.
  return (
    <div className="shell">
      <header className="appbar">
        <div className="brand">
          <span className="logo"><HeartPulse size={22} /></span>
          <div>
            <h1>HealthNav</h1>
            <p>Hi {user.name.split(" ")[0]}, how are you feeling?</p>
          </div>
        </div>
        <button className="bell" onClick={logout} aria-label="Sign out" title="Sign out">
          <LogOut size={18} />
        </button>
      </header>

      <main className="content">
        <Routes>
          <Route path="/home" element={<Home />} />
          <Route path="/triage" element={<SymptomChecker />} />
          <Route path="/nearby" element={<Locator />} />
          <Route path="/meds" element={<Reminders />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/history" element={<History />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </main>

      {/* Floating Health AI button — hidden while already on the chat page. */}
      {location.pathname !== "/chat" && (
        <button className="fab" onClick={() => navigate("/chat")} aria-label="Chat with Health AI">
          <Bot size={24} />
          <span className="fab-tip">Chat with Health AI</span>
        </button>
      )}

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
