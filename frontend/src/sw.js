// Custom service worker (injectManifest): Workbox precache + Web Push handlers.
import { precacheAndRoute } from "workbox-precaching";
import { clientsClaim } from "workbox-core";

self.skipWaiting();
clientsClaim();

// Precache the built app shell (manifest injected by vite-plugin-pwa).
precacheAndRoute(self.__WB_MANIFEST || []);

// A medication reminder (or test) push arrived — show a card notification.
self.addEventListener("push", (event) => {
  let data = { title: "HealthNav", body: "Reminder", url: "/meds" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {
    /* payload wasn't JSON */
  }

  // Interactive Take / Skip buttons when we know which reminder this is.
  const actions = data.reminderId
    ? [
        { action: "take", title: "✓ Take" },
        { action: "skip", title: "✕ Skip" },
      ]
    : [];

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || "healthnav-reminder",
      requireInteraction: Boolean(data.reminderId), // keep meds reminders until acted on
      data: { url: data.url || "/meds", reminderId: data.reminderId },
      actions,
    })
  );
});

// Log the dose straight from the notification, or open the app.
self.addEventListener("notificationclick", (event) => {
  const { reminderId, url } = event.notification.data || {};
  event.notification.close();

  if ((event.action === "take" || event.action === "skip") && reminderId) {
    const req =
      event.action === "take"
        ? fetch(`/api/reminders/${reminderId}/taken`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taken: true }),
            credentials: "include",
          })
        : fetch(`/api/reminders/${reminderId}/skip`, { method: "PATCH", credentials: "include" });

    event.waitUntil(
      req
        .then((r) =>
          self.registration.showNotification(
            r.ok ? (event.action === "take" ? "Logged ✓" : "Skipped") : "Couldn't log — open the app",
            { body: r.ok ? "" : "Your session may have expired.", tag: `med-${reminderId}` }
          )
        )
        .catch(() =>
          self.registration.showNotification("Couldn't log dose", {
            body: "Open the app to update it.",
            tag: `med-${reminderId}`,
          })
        )
    );
    return;
  }

  // Body tap → focus/open the app.
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url || "/meds");
          return client.focus();
        }
      }
      return self.clients.openWindow(url || "/meds");
    })
  );
});
