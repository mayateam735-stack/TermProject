import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle, ChevronDown, Clock, ExternalLink, Hourglass, MapPin, Navigation, Phone,
} from "lucide-react";
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

function relativeTime(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

// edwaittimes wait status -> label + tone class.
const STATUS = {
  normal: ["Normal", "ok"],
  busy: ["Busy", "warn"],
  veryBusy: ["Very busy", "bad"],
  closed: ["Closed", "bad"],
  open: ["Open", "ok"],
};
const statusLabel = (s) => (STATUS[s] ? STATUS[s][0] : s);
const statusTone = (s) => (STATUS[s] ? STATUS[s][1] : "");

const FILTERS = [
  { key: "", label: "All" },
  { key: "hospital", label: "Hospitals" },
  { key: "clinic", label: "Urgent care" },
  { key: "pharmacy", label: "Pharmacies" },
];

function DetailStat({ label, value, tone }) {
  return (
    <div className="detail-stat">
      <div className="detail-label">{label}</div>
      <div className={`detail-value ${tone || ""}`}>{value}</div>
    </div>
  );
}

// Expanded panel: extra live info pulled from edwaittimes.ca.
function ClinicDetail({ c }) {
  const dir = `https://www.google.com/maps/dir/?api=1&destination=${c.latitude},${c.longitude}`;
  return (
    <div className="clinic-detail" onClick={(e) => e.stopPropagation()}>
      {c.alert && (
        <div className="clinic-alert"><AlertTriangle size={15} /> <span>{c.alert}</span></div>
      )}
      <div className="detail-grid">
        {c.wait_status && <DetailStat label="Status" value={statusLabel(c.wait_status)} tone={statusTone(c.wait_status)} />}
        {c.elos_min != null && <DetailStat label="Typical total visit" value={formatWait(c.elos_min)} />}
        {c.audience && <DetailStat label="Who it's for" value={c.audience} />}
        {c.updated_at && <DetailStat label="Wait updated" value={relativeTime(c.updated_at)} />}
      </div>
      {c.description && <p className="detail-note">{c.description}</p>}
      {c.additional_info && <p className="detail-note">{c.additional_info}</p>}
      <div className="detail-actions">
        <a className="detail-btn" href={dir} target="_blank" rel="noreferrer"><Navigation size={15} /> Directions</a>
        {c.phone && <a className="detail-btn" href={`tel:${c.phone}`}><Phone size={15} /> Call</a>}
        {c.website && <a className="detail-btn" href={c.website} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Website</a>}
      </div>
    </div>
  );
}

export default function Locator() {
  const [clinics, setClinics] = useState([]);
  const [kind, setKind] = useState("");
  const [coords, setCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState(null);
  const [error, setError] = useState(null);
  const [focusRequest, setFocusRequest] = useState(null); // { id, key } — key makes re-clicking the same card refocus
  const [openId, setOpenId] = useState(null); // which live card is expanded
  const mapSectionRef = useRef(null);

  function focusClinic(id) {
    setFocusRequest({ id, key: Date.now() });
    mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const toggle = (id) => setOpenId((cur) => (cur === id ? null : id));

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

      {clinics.map((c) => {
        const live = c.source === "edwaittimes.ca";
        const open = openId === c.id;
        return (
          <div
            className={`card locator-card ${open ? "open" : ""}`}
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
                <MapPin size={14} /> {c.open_hours || (c.open247 ? "24/7" : "Hours vary")}
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

            {live ? (
              <>
                {/* Separate control so expanding detail doesn't also scroll to the map. */}
                <button
                  type="button"
                  className="expand-row"
                  aria-expanded={open}
                  onClick={(e) => { e.stopPropagation(); toggle(c.id); }}
                >
                  <span>{open ? "Hide details" : "More info"}</span>
                  <ChevronDown size={16} className={`chev ${open ? "up" : ""}`} />
                </button>
                {open && <ClinicDetail c={c} />}
              </>
            ) : (
              c.phone && (
                <a
                  className="muted"
                  href={`tel:${c.phone}`}
                  onClick={(e) => e.stopPropagation()}
                  style={{ display: "inline-block", marginTop: "0.4rem", fontSize: "0.8rem" }}
                >
                  📞 {c.phone}
                </a>
              )
            )}
          </div>
        );
      })}

      {hasLive && (
        <p className="disclaimer" style={{ textAlign: "center" }}>
          <Hourglass size={12} style={{ verticalAlign: "-2px" }} /> Live ER &amp; urgent-care wait
          times are estimates, via{" "}
          <a href="https://edwaittimes.ca" target="_blank" rel="noreferrer">edwaittimes.ca</a>.
        </p>
      )}
    </section>
  );
}
