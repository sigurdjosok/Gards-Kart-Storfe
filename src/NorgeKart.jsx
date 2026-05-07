import React, { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const NORWAY_CENTER = [64.5, 11.5];

function emojiIcon(emoji, bg) {
  return L.divIcon({
    className: "",
    html: `<div style="width:30px;height:30px;border-radius:9999px;display:flex;align-items:center;justify-content:center;background:${bg};box-shadow:0 4px 14px rgba(0,0,0,.18);border:1px solid rgba(0,0,0,.08);font-size:18px;">${emoji}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28],
  });
}

const ICONS = {
  storfe: emojiIcon("🐄", "#bbf7d0"),
  svin: emojiIcon("🐖", "#fbcfe8"),
  begge: emojiIcon("🐄🐖", "#e9d5ff"),
  tine: emojiIcon("🥛", "#bfdbfe"),
};

function normalize(s) {
  return (s || "").toString().trim();
}

function parseCSV(text, defaults = { category: "storfe", status: "ukjent" }) {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const first = lines[0].replace(/^\uFEFF/, "");
  const sep = first.includes(";") ? ";" : ",";

  const header = first.split(sep).map(h => h.trim().toLowerCase());
  const idx = (k) => header.indexOf(k);

  const get = (cols, key, fallbackIndex = -1) => {
    const i = idx(key);
    if (i >= 0) return cols[i] ?? "";
    if (fallbackIndex >= 0) return cols[fallbackIndex] ?? "";
    return "";
  };

  const out = [];
  for (let r = 1; r < lines.length; r++) {
    const cols = lines[r].split(sep).map(c => c.trim());

    const name =
      get(cols, "name", cols.length >= 2 ? 1 : 0) ||
      get(cols, "egendefinert.navn") ||
      "";

    const address =
      get(cols, "address", cols.length >= 3 ? 2 : -1) ||
      get(cols, "full_adresse") ||
      "";

    if (!name || !address) continue;

    const categoryRaw = (get(cols, "category") || defaults.category).toLowerCase();
    const statusRaw = (get(cols, "status") || defaults.status).toLowerCase();

    out.push({
      name,
      category: ICONS[categoryRaw] ? categoryRaw : defaults.category,
      status: statusRaw === "drift" ? "drift" : "ukjent",
      address,
      lat: undefined,
      lon: undefined,
    });
  }

  return out;
}

async function geocodeNominatim(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  if (!json.length) return null;

  return { lat: Number(json[0].lat), lon: Number(json[0].lon) };
}

function useGeocode(items) {
  const [resolved, setResolved] = useState(items);

  useEffect(() => {
    setResolved(items);
  }, [items]);

  useEffect(() => {
    const run = async () => {
      const updated = [...items];

      for (let i = 0; i < updated.length; i++) {
        if (updated[i].address && !updated[i].lat) {
          const hit = await geocodeNominatim(updated[i].address);
          if (hit) updated[i] = { ...updated[i], ...hit };
        }
      }

      setResolved(updated);
    };

    run();
  }, [items]);

  return resolved;
}

export default function NorgeKart() {
  const isSvin = window.location.search.includes("view=svin");
  const file = isSvin ? "svin.csv" : "datasett.csv";

  const [data, setData] = useState([]);

  useEffect(() => {
    fetch(`${window.location.origin}/${file}`)
      .then(r => r.text())
      .then(txt => {
        const parsed = parseCSV(txt, isSvin ? { category: "svin", status: "drift" } : {});
        setData(parsed);
      });
  }, [file]);

  const resolved = useGeocode(data);
  const markers = resolved.filter(x => x.lat && x.lon);

  return (
    <div>
      <h2>{isSvin ? "🐖 Svinebønder" : "🗺️ Norgekart"}</h2>
      <div>
        <a href="/">Alle</a> | <a href="/?view=svin">Svin</a>
      </div>

      <MapContainer center={NORWAY_CENTER} zoom={4} style={{ height: "600px" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {markers.map((m, i) => (
          <Marker key={i} position={[m.lat, m.lon]} icon={ICONS[m.category] || ICONS.storfe}>
            <Popup>
              <b>{m.name}</b><br />
              {m.address}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
