// Web Push subscription helpers (frontend side).
import { api } from "./api.js";

function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/** Request permission, subscribe to push, and register with the backend. */
export async function enableNotifications() {
  if (!pushSupported()) throw new Error("Notifications aren't supported in this browser.");
  if (!window.isSecureContext) {
    throw new Error("Push needs a secure page — use http://localhost (or HTTPS), not a LAN IP.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was denied.");

  const reg = await navigator.serviceWorker.ready;
  const { key } = await api.vapidKey();
  const appKey = urlBase64ToUint8Array(key);

  // Drop any stale subscription (e.g. from a previous/rotated VAPID key) so we
  // don't hit "a subscription with a different key already exists".
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    try { await existing.unsubscribe(); } catch (e) { /* ignore */ }
  }

  let sub;
  try {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
  } catch (e) {
    // Retry once after clearing state — resolves most transient FCM errors.
    try {
      const s = await reg.pushManager.getSubscription();
      if (s) await s.unsubscribe();
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
    } catch (e2) {
      throw new Error(
        `Couldn't reach the push service (${e2.name || "error"}). ` +
        "This is common in dev mode — try the built app (npm run build && npm run preview), " +
        "use desktop Chrome on localhost, or on a phone install the app to your home screen first."
      );
    }
  }

  const json = sub.toJSON();
  await api.pushSubscribe({
    endpoint: json.endpoint,
    keys: json.keys,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  });
  return true;
}

export async function disableNotifications() {
  const sub = await currentSubscription();
  if (sub) {
    await api.pushUnsubscribe(sub.endpoint).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
}
