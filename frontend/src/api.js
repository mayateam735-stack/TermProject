// Thin API client for the VHN backend. Requests are proxied to the FastAPI
// server (see vite.config.js) in development.

async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`API ${res.status}: ${detail}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  triage: (symptom_text, age) =>
    request("/api/triage", {
      method: "POST",
      body: JSON.stringify({ symptom_text, age: age ?? null }),
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
  deleteReminder: (id) =>
    request(`/api/reminders/${id}`, { method: "DELETE" }),
};
