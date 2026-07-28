import { useState } from "react";
import { Download, Share, X } from "lucide-react";
import { useInstallPrompt } from "../pwa.js";

/**
 * Prompts the user to install the PWA. Shows a native "Install" button where the
 * browser supports it (Android/desktop Chrome & Edge), or an "Add to Home Screen"
 * hint on iOS Safari. Dismissal is in-memory only — no client-side storage, per
 * the project rule that app state lives in the database.
 */
export default function InstallBanner() {
  const { canInstall, iosHint, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || (!canInstall && !iosHint)) return null;

  return (
    <div className="card install-banner">
      <span className="install-icon">
        <img src="/icon-192.png" alt="" width={40} height={40} />
      </span>
      <div className="install-copy">
        <strong>Install HealthNav</strong>
        {iosHint ? (
          <span>
            Tap <Share size={13} className="ios-share" /> Share, then “Add to Home Screen”.
          </span>
        ) : (
          <span>Add it to your home screen for quick, full-screen access.</span>
        )}
      </div>
      {canInstall && (
        <button className="install-btn" onClick={promptInstall}>
          <Download size={16} /> Install
        </button>
      )}
      <button className="install-x" onClick={() => setDismissed(true)} aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  );
}
