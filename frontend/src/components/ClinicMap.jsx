import { useEffect, useRef, useState } from "react";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

let scriptPromise = null;

// Loads the Maps JS API exactly once, however many ClinicMap instances mount.
function loadGoogleMaps() {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}`;
    script.async = true;
    script.onload = () => resolve(window.google.maps);
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

const KIND_COLOR = {
  hospital: "#ef4444",
  clinic: "#4f6df5",
  pharmacy: "#22c55e",
};

export default function ClinicMap({ clinics, coords }) {
  const mapRef = useRef(null);
  const mapObjRef = useRef(null);
  const markersRef = useRef([]);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (!API_KEY) {
      setLoadError("Map unavailable — no Google Maps API key configured.");
      return;
    }
    let cancelled = false;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !mapRef.current) return;
        mapObjRef.current = new maps.Map(mapRef.current, {
          center: coords ?? { lat: 49.2257, lng: -122.8893 },
          zoom: coords ? 13 : 12,
          disableDefaultUI: true,
          zoomControl: true,
        });
      })
      .catch((e) => !cancelled && setLoadError(e.message));
    return () => {
      cancelled = true;
    };
    // Only load/init the map once; marker updates are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const maps = window.google?.maps;
    const map = mapObjRef.current;
    if (!maps || !map) return;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const bounds = new maps.LatLngBounds();
    let hasBounds = false;

    if (coords) {
      const userMarker = new maps.Marker({
        map,
        position: coords,
        title: "Your location",
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#4f6df5",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
        zIndex: 999,
      });
      markersRef.current.push(userMarker);
      bounds.extend(coords);
      hasBounds = true;
    }

    const infoWindow = new maps.InfoWindow();

    clinics.forEach((c) => {
      if (c.latitude == null || c.longitude == null) return;
      const position = { lat: c.latitude, lng: c.longitude };
      const marker = new maps.Marker({
        map,
        position,
        title: c.name,
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: KIND_COLOR[c.kind] ?? "#4f6df5",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
      });
      marker.addListener("click", () => {
        infoWindow.setContent(
          `<div style="font-family:Inter,system-ui,sans-serif;max-width:200px">
             <strong>${c.name}</strong><br/>
             <span style="color:#475569;font-size:0.85rem">${c.address}</span>
             ${c.estimated_wait_min != null ? `<br/><span style="font-size:0.85rem">Est. wait: ${c.estimated_wait_min} min</span>` : ""}
           </div>`
        );
        infoWindow.open({ map, anchor: marker });
      });
      markersRef.current.push(marker);
      bounds.extend(position);
      hasBounds = true;
    });

    if (hasBounds) map.fitBounds(bounds, 48);
  }, [clinics, coords]);

  if (loadError) {
    return <div className="card muted" style={{ textAlign: "center" }}>{loadError}</div>;
  }

  return (
    <div
      className="card"
      style={{ padding: 0, overflow: "hidden", height: "220px" }}
    >
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
