import { useEffect, useState } from "react";
import { Clock, MapPin } from "lucide-react";
import { api } from "../api.js";

const MAX_WAIT = 240;
const FILTERS = [
  { key: "", label: "All" },
  { key: "clinic", label: "Clinics" },
  { key: "pharmacy", label: "Pharmacies" },
  { key: "hospital", label: "Hospitals" },
];

export default function Locator() {
  const [clinics, setClinics] = useState([]);
  const [kind, setKind] = useState("");
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setCoords(null)
    );
  }, []);

  useEffect(() => {
    api
      .clinics({ kind: kind || undefined, lat: coords?.lat, lng: coords?.lng })
      .then(setClinics)
      .catch((e) => setError(e.message));
  }, [kind, coords]);

  return (
    <section>
      <h2 className="page-title">Nearby care</h2>
      <p className="page-sub">
        {coords ? "Sorted by distance from you." : "Enable location to sort by distance."}
      </p>

      <div className="chips" style={{ marginBottom: "1rem" }}>
        {FILTERS.map((f) => (
          <button key={f.key} className={`chip ${kind === f.key ? "on" : ""}`} onClick={() => setKind(f.key)} type="button">
            {f.label}
          </button>
        ))}
      </div>

      {error && <div className="card" style={{ color: "var(--emergency)" }}>{error}</div>}

      {clinics.map((c) => (
        <div className="card" key={c.id}>
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
                <span style={{ fontWeight: 700 }}>{c.estimated_wait_min} min</span>
              </div>
              <div className="wait-bar">
                <span style={{ width: `${Math.min(100, (c.estimated_wait_min / MAX_WAIT) * 100)}%` }} />
              </div>
            </>
          )}
        </div>
      ))}
    </section>
  );
}
