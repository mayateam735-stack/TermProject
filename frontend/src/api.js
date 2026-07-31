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
  skipReminder: (id) =>
    request(`/api/reminders/${id}/skip`, { method: "PATCH" }),
  adherence: (weekOffset = 0) =>
    request(`/api/reminders/adherence?week_offset=${weekOffset}`),
  adherenceStreak: () => request("/api/reminders/streak"),
  searchMedications: (q) =>
    request(`/api/medications/search?q=${encodeURIComponent(q)}`),
  reminderDetail: (id) => request(`/api/reminders/${id}`),
  medicationInfo: (name) =>
    request(`/api/medications/info?name=${encodeURIComponent(name)}`),

  // Admin
  adminStats: () => request("/api/admin/stats"),
  adminTimeseries: (days = 30) => request(`/api/admin/timeseries?days=${days}`),
  adminUsers: () => request("/api/admin/users"),
  adminUser: (id) => request(`/api/admin/users/${id}`),
  adminUpdateUser: (id, body) =>
    request(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  adminDeleteUser: (id) => request(`/api/admin/users/${id}`, { method: "DELETE" }),

  // Web Push
  vapidKey: () => request("/api/push/vapid-key"),
  pushSubscribe: (body) =>
    request("/api/push/subscribe", { method: "POST", body: JSON.stringify(body) }),
  pushUnsubscribe: (endpoint) =>
    request("/api/push/unsubscribe", { method: "POST", body: JSON.stringify({ endpoint }) }),
  pushTest: () => request("/api/push/test", { method: "POST" }),
  deleteReminder: (id) =>
    request(`/api/reminders/${id}`, { method: "DELETE" }),

  listSymptomChecks: (limit = 5) =>
    request(`/api/symptom-checks?limit=${limit}`),

  chat: (message, history = []) =>
    request("/api/chat", { method: "POST", body: JSON.stringify({ message, history }) }),
  aiStatus: () => request("/api/ai/status"),

  updateMe: (body) =>
    request("/api/patients/me", { method: "PATCH", body: JSON.stringify(body) }),
  appOpen: () => request("/api/patients/me/open", { method: "POST" }),
  history: (limit = 50) => request(`/api/symptom-checks?limit=${limit}`),

  // Doctors
  listDoctors: () => request("/api/doctors"),
  doctorPatients: () => request("/api/doctor/patients"),
  doctorPatient: (id) => request(`/api/doctor/patients/${id}`),
  doctorPatientHistory: (id) => request(`/api/doctor/patients/${id}/history`),
  doctorPatientMeds: (id) => request(`/api/doctor/patients/${id}/medications`),

  // Insurance cost analysis
  insurancePlans: () => request("/api/insurance/plans"),
  insuranceEstimate: (usage) =>
    request("/api/insurance/estimate", { method: "POST", body: JSON.stringify(usage) }),
};
