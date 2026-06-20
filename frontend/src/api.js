// Thin API client for the VHN backend. Requests are proxied to the FastAPI
// server (see vite.config.js) in development.

async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    credentials: "include", // send/receive the HTTP-only session cookie
    ...options,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) message = typeof body.detail === "string" ? body.detail : message;
    } catch {
      /* non-JSON error body */
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // ---- Auth ----
  signup: (body) => request("/api/auth/signup", { method: "POST", body: JSON.stringify(body) }),
  login: (body) => request("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  me: () => request("/api/auth/me"),

  triage: ({ symptom_text, age = null, pain_level = 0, duration = null }) =>
    request("/api/triage", {
      method: "POST",
      body: JSON.stringify({ symptom_text, age, pain_level, duration }),
    }),

  clinics: ({ kind, lat, lng } = {}) => {
    const params = new URLSearchParams();
    if (kind) params.set("kind", kind);
    if (lat != null && lng != null) {
      params.set("lat", lat);
      params.set("lng", lng);
    }
    const qs = params.toString();
    return request(`/api/clinics${qs ? `?${qs}` : ""}`);
  },

  listReminders: () => request("/api/reminders"),
  createReminder: (body) =>
    request("/api/reminders", { method: "POST", body: JSON.stringify(body) }),
  setReminderTaken: (id, taken) =>
    request(`/api/reminders/${id}/taken`, {
      method: "PATCH",
      body: JSON.stringify({ taken }),
    }),
  deleteReminder: (id) =>
    request(`/api/reminders/${id}`, { method: "DELETE" }),

  listSymptomChecks: (limit = 5) =>
    request(`/api/symptom-checks?limit=${limit}`),

  chat: (message) =>
    request("/api/chat", { method: "POST", body: JSON.stringify({ message }) }),
};
