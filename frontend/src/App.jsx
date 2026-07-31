import { lazy, Suspense } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Bot, Home as HomeIcon, HeartPulse, LogOut, MapPin, Moon, Pill, Sun, User } from "lucide-react";
import { useAuth } from "./auth.jsx";
import Home from "./pages/Home.jsx";
import SymptomChecker from "./pages/SymptomChecker.jsx";
import Locator from "./pages/Locator.jsx";
import Reminders from "./pages/Reminders.jsx";
import MedicationDetail from "./pages/MedicationDetail.jsx";
import Profile from "./pages/Profile.jsx";
import EditProfile from "./pages/EditProfile.jsx";
import History from "./pages/History.jsx";
import Adherence from "./pages/Adherence.jsx";
import Insurance from "./pages/Insurance.jsx";
import Chat from "./pages/Chat.jsx";
import DoctorDashboard from "./pages/DoctorDashboard.jsx";
import DoctorPatient from "./pages/DoctorPatient.jsx";
// Admin pages pull in recharts — lazy-load so patients never download that chunk.
const AdminDashboard = lazy(() => import("./pages/AdminDashboard.jsx"));
const AdminUsers = lazy(() => import("./pages/AdminUsers.jsx"));
const AdminUserEdit = lazy(() => import("./pages/AdminUserEdit.jsx"));
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
  const { user, loading, logout, theme, toggleTheme } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true }); // returning users log back in, not sign up again
  };

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

  // Admins get an analytics dashboard shell.
  if (user.role === "admin") {
    return (
      <div className="shell">
        <header className="appbar">
          <div className="brand">
            <span className="logo"><HeartPulse size={22} /></span>
            <div>
              <h1>HealthNav</h1>
              <p>{user.name.split(" ")[0]} · Admin</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="bell" onClick={toggleTheme} aria-label="Toggle dark mode">
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="bell" onClick={handleLogout} aria-label="Sign out" title="Sign out">
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main className="content">
          <Suspense fallback={<div className="card skeleton-row" />}>
            <Routes>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/users/:id" element={<AdminUserEdit />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    );
  }

  // Doctors get a dedicated dashboard shell (no patient tabs).
  if (user.role === "doctor") {
    return (
      <div className="shell">
        <header className="appbar">
          <div className="brand">
            <span className="logo"><HeartPulse size={22} /></span>
            <div>
              <h1>HealthNav</h1>
              <p>Dr. {user.name.split(" ")[0]} · Clinician</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="bell" onClick={toggleTheme} aria-label="Toggle dark mode">
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="bell" onClick={handleLogout} aria-label="Sign out" title="Sign out">
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main className="content">
          <Routes>
            <Route path="/doctor" element={<DoctorDashboard />} />
            <Route path="/doctor/patients/:id" element={<DoctorPatient />} />
            <Route path="*" element={<Navigate to="/doctor" replace />} />
          </Routes>
        </main>
      </div>
    );
  }

  // Logged in as a patient — the full app shell.
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
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="bell" onClick={toggleTheme} aria-label="Toggle dark mode"
            title={theme === "dark" ? "Switch to light" : "Switch to dark"}>
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="bell" onClick={handleLogout} aria-label="Sign out" title="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="content">
        <Routes>
          <Route path="/home" element={<Home />} />
          <Route path="/triage" element={<SymptomChecker />} />
          <Route path="/nearby" element={<Locator />} />
          <Route path="/meds" element={<Reminders />} />
          <Route path="/meds/adherence" element={<Adherence />} />
          <Route path="/meds/:id" element={<MedicationDetail />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/edit" element={<EditProfile />} />
          <Route path="/history" element={<History />} />
          <Route path="/insurance" element={<Insurance />} />
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
