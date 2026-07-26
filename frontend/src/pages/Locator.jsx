import { useEffect, useRef, useState } from "react";
import { Clock, MapPin, Navigation } from "lucide-react";
import { api } from "../api.js";
import ClinicMap from "../components/ClinicMap.jsx";

const MAX_WAIT = 240;

// 130 -> "2h 10m", 45 -> "45 min", 120 -> "2h"
function formatWait(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

const FILTERS = [
  { key: "", label: "All" },
  { key: "hospital", label: "Hospitals" },
  { key: "clinic", label: "Urgent care" },
  { key: "pharmacy", label: "Pharmacies" },
];

export default function Locator() {
  const [clinics, setClinics] = useState([]);
  const [kind, setKind] = useState("");
  const [coords, setCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState(null);
  const [error, setError] = useState(null);
  const [focusRequest, setFocusRequest] = useState(null); // { id, key } — key makes re-clicking the same card refocus
  const mapSectionRef = useRef(null);

  function focusClinic(id) {
    setFocusRequest({ id, key: Date.now() });
    mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const hasLive = clinics.some((c) => c.source === "edwaittimes.ca");

  function requestLocation(silent = false) {
    if (!navigator.geolocation) {
      if (!silent) setGeoError("Location isn't supported on this device.");
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        if (silent) return; // don't nag on the automatic first try
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "Location is blocked. Allow it in your browser to sort by distance."
            : "Couldn't get your location — showing all results."
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  // Best-effort automatic attempt on first load (silent if denied).
  useEffect(() => requestLocation(true), []);

  useEffect(() => {
    api
      .clinics({ kind: kind || undefined, lat: coords?.lat, lng: coords?.lng })
      .then(setClinics)
      .catch((e) => setError(e.message));
  }, [kind, coords]);

  return (
    <section>
      <h2 className="page-title">Nearby care</h2>
      <p className="page-sub">Find hospitals, urgent care and pharmacies near you.</p>

      <button className="locate-btn" onClick={() => requestLocation(false)} disabled={locating}>
        <Navigation size={16} />
        {locating ? "Locating…" : coords ? "Location on — update" : "Use my location"}
      </button>
      {geoError && <p className="muted" style={{ marginTop: "-0.4rem" }}>{geoError}</p>}
      {coords && !geoError && (
        <p className="muted" style={{ marginTop: "-0.4rem" }}>Sorted by distance from you.</p>
      )}

      <div ref={mapSectionRef}>
        <ClinicMap clinics={clinics} coords={coords} focusId={focusRequest?.id} focusKey={focusRequest?.key} />
      </div>

      <div className="chips" style={{ margin: "0.8rem 0 1rem" }}>
        {FILTERS.map((f) => (
          <button key={f.key} className={`chip ${kind === f.key ? "on" : ""}`} onClick={() => setKind(f.key)} type="button">
            {f.label}
          </button>
        ))}
      </div>

      {error && <div className="card" style={{ color: "var(--emergency)" }}>{error}</div>}

      {clinics.map((c) => (
        <div
          className="card"
          key={c.id}
          onClick={() => focusClinic(c.id)}
          style={{ cursor: "pointer" }}
        >
          <div className="row" style={{ marginBottom: "0.35rem" }}>
            <strong style={{ fontSize: "0.98rem" }}>{c.name}</strong>
            <span className="kind-tag">{c.kind}</span>
          </div>
          <div className="row">
            <span className="muted" style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <MapPin size={14} /> {c.open_hours}
            </span>
            {c.distance_km != null && <span className="muted">{c.distance_km} km</span>}
          </div>
          <div className="muted" style={{ marginTop: "0.3rem", fontSize: "0.8rem" }}>{c.address}</div>
          {c.estimated_wait_min != null && (
            <>
              <div className="row" style={{ marginTop: "0.6rem" }}>
                <span className="time-pill"><Clock size={14} /> Est. wait</span>
                <span style={{ fontWeight: 700 }}>{formatWait(c.estimated_wait_min)}</span>
              </div>
              <div className="wait-bar">
                <span style={{ width: `${Math.min(100, (c.estimated_wait_min / MAX_WAIT) * 100)}%` }} />
              </div>
            </>
          )}
          {c.phone && (
            <a className="muted" href={`tel:${c.phone}`} style={{ display: "inline-block", marginTop: "0.4rem", fontSize: "0.8rem" }}>
              📞 {c.phone}
            </a>
          )}
        </div>
      ))}

      {hasLive && (
        <p className="disclaimer" style={{ textAlign: "center" }}>
          Live ER &amp; urgent-care wait times are estimates, via{" "}
          <a href="https://edwaittimes.ca" target="_blank" rel="noreferrer">edwaittimes.ca</a>.
        </p>
      )}
    </section>
  );
}
