import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Free OpenStreetMap tiles via Leaflet — no API key or billing required.
const KIND_COLOR = {
  hospital: "#ef4444",
  clinic: "#f97316",
  pharmacy: "#22c55e",
};

const DEFAULT_CENTER = [49.2257, -122.8893]; // Metro Vancouver

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch])
  );
}

export default function ClinicMap({ clinics, coords, focusId, focusKey }) {
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const markersByIdRef = useRef(new Map());

  // Initialise the map exactly once.
  useEffect(() => {
    if (mapRef.current || !mapElRef.current) return;
    const map = L.map(mapElRef.current, { zoomControl: true }).setView(
      coords ? [coords.lat, coords.lng] : DEFAULT_CENTER,
      coords ? 13 : 11
    );
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    // The card animates/expands in; make sure Leaflet measures the final size.
    setTimeout(() => map.invalidateSize(), 60);
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild markers whenever the clinic list or user location changes.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    markersByIdRef.current.clear();
    const points = [];

    if (coords) {
      L.circleMarker([coords.lat, coords.lng], {
        radius: 7, color: "#fff", weight: 2, fillColor: "#4f6df5", fillOpacity: 1,
      }).addTo(layer).bindPopup("Your location");
      points.push([coords.lat, coords.lng]);
    }

    clinics.forEach((c) => {
      if (c.latitude == null || c.longitude == null) return;
      const latlng = [c.latitude, c.longitude];
      const marker = L.circleMarker(latlng, {
        radius: 7, color: "#fff", weight: 2,
        fillColor: KIND_COLOR[c.kind] ?? "#4f6df5", fillOpacity: 1,
      }).addTo(layer);
      marker.bindPopup(
        `<div style="font-family:Inter,system-ui,sans-serif;max-width:200px">
           <strong>${escapeHtml(c.name)}</strong><br/>
           <span style="color:#475569;font-size:0.85rem">${escapeHtml(c.address)}</span>
           ${c.estimated_wait_min != null
             ? `<br/><span style="font-size:0.85rem">Est. wait: ${c.estimated_wait_min} min</span>`
             : ""}
         </div>`
      );
      markersByIdRef.current.set(c.id, { marker, latlng });
      points.push(latlng);
    });

    if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
  }, [clinics, coords]);

  // Click a clinic card → pan/zoom to it and open its popup.
  useEffect(() => {
    if (focusId == null) return;
    const map = mapRef.current;
    const entry = markersByIdRef.current.get(focusId);
    if (!map || !entry) return;
    map.setView(entry.latlng, Math.max(map.getZoom(), 15), { animate: true });
    entry.marker.openPopup();
    // focusKey changes on every click so re-clicking the same card refocuses.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, focusKey]);

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", height: "220px" }}>
      <div ref={mapElRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
