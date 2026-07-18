import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api.js";

const AuthContext = createContext(null);

// Default to the OS preference before we know the signed-in user's choice.
// (No localStorage — the user's saved theme lives in the database.)
function systemTheme() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(systemTheme);

  // Resolve the current user from the session cookie on load.
  useEffect(() => {
    api
      .me()
      .then((u) => {
        setUser(u);
        if (u?.theme) setTheme(u.theme);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // Apply the theme to the document root so the CSS token overrides kick in.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const signup = async (body) => {
    const u = await api.signup(body);
    setUser(u);
    if (u?.theme) setTheme(u.theme);
  };
  const login = async (body) => {
    const u = await api.login(body);
    setUser(u);
    if (u?.theme) setTheme(u.theme);
  };
  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  // Flip the theme instantly; persist to the DB for signed-in users.
  const toggleTheme = async () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (user) {
      try {
        setUser(await api.updateMe({ theme: next }));
      } catch {
        /* keep the in-session change even if the save fails */
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, signup, login, logout, setUser, theme, toggleTheme }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
