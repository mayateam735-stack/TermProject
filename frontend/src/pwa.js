// PWA install-prompt plumbing.
//
// `beforeinstallprompt` fires very early — often before React has mounted — so we
// capture and stash the event at module load and let components subscribe later.
import { useEffect, useReducer } from "react";

let deferredPrompt = null;
const subscribers = new Set();
const notify = () => subscribers.forEach((fn) => fn());

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true // iOS Safari
  );
}

export function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // stop Chrome's default mini-infobar; we prompt on demand
    deferredPrompt = e;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
}

/** Fire the native install dialog. Returns true if the user accepted. */
export async function promptInstall() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  notify();
  return outcome === "accepted";
}

/** React hook: re-renders when installability changes. */
export function useInstallPrompt() {
  const [, force] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    subscribers.add(force);
    return () => subscribers.delete(force);
  }, []);

  const installed = isStandalone();
  return {
    canInstall: Boolean(deferredPrompt) && !installed, // Android / desktop Chrome, Edge
    iosHint: isIOS() && !installed, // iOS Safari can't auto-prompt — show instructions
    installed,
    promptInstall,
  };
}
