
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

// TINE anlegg, hentet fra intern fil, adresser, kategorier
// Kilde, <File>TINE oversikt anlegg og kontaktpersoner.xlsx</File>
const TINE_SITES = [
  { name: "TINE Meieriet Alta", category: "tine", status: "drift", address: "Meieriveien 5, 9510 Alta" },
  { name: "TINE Meieriet Bergen", category: "tine", status: "drift", address: "Espehaugen 18, 5258 Blomsterdalen" },
  { name: "TINE Meieriet Brumunddal", category: "tine", status: "drift", address: "Strandsagvegen 1, 2383 Brumunddal" },
  { name: "TINE Meieriet Byrkjelo", category: "tine", status: "drift", address: "Meierivegen 1, 6826 Byrkjelo" },
  { name: "TINE Meieriet Dovre", category: "tine", status: "drift", address: "Stasjonsvegen 10, 2662 Dovre" },
  { name: "TINE Meieriet Elnesvågen", category: "tine", status: "drift", address: "Sjøvegen 4, 6440 Elnesvågen" },
  { name: "TINE Meieriet Frya", category: "tine", status: "drift", address: "Fryavegen 64, 2630 Ringebu" },
  { name: "TINE Meieriet Haukeli", category: "tine", status: "drift", address: "Storegutvegen 165, 3895 Edland" },
  { name: "TINE Meieriet Jæren", category: "tine", status: "drift", address: "Næringsvegen 21, 4365 Nærbø" },
  { name: "TINE Meieriet Lom og Skjåk", category: "tine", status: "drift", address: "Skjåkvegen 8, 2690 Skjåk" },
  { name: "TINE Meieriet Oslo Kalbakken", category: "tine", status: "drift", address: "Bedriftsveien 7, 0950 Oslo" },
  { name: "TINE Meieriet Sandnessjøen", category: "tine", status: "drift", address: "Alstenveien 51, 8800 Sandnessjøen" },
  { name: "TINE Meieriet Selbu", category: "tine", status: "drift", address: "Selbuvegen 1234, 7580 Selbu" },
  { name: "TINE Meieriet Setesdal", category: "tine", status: "drift", address: "Setesdalsvegen 2019, 4741 Byglandsfjord" },
  { name: "TINE Meieriet Storsteinnes", category: "tine", status: "drift", address: "Meieriveien 21, 9050 Storsteinnes" },
  { name: "TINE Meieriet Sømna", category: "tine", status: "drift", address: "Saltnesodden 3, 8920 Sømna" },
  { name: "TINE Meieriet Tana", category: "tine", status: "drift", address: "Grenveien 7, 9845 Tana" },
  { name: "TINE Meieriet Tresfjord", category: "tine", status: "drift", address: "Sylteøyran 3, 6391 Tresfjord" },
  { name: "TINE Meieriet Tretten", category: "tine", status: "drift", address: "Musdalsvegen 34, 2635 Tretten" },
  { name: "TINE Meieriet Trysil", category: "tine", status: "drift", address: "Parkvegen 8, 2422 Nybergsund" },
  { name: "TINE Meieriet Tunga", category: "tine", status: "drift", address: "Bromstadvegen 68, 7047 Trondheim" },
  { name: "TINE Meieriet Verdal", category: "tine", status: "drift", address: "Melkevegen 1, 7652 Verdal" },
  { name: "TINE Meieriet Vik", category: "tine", status: "drift", address: "Vikøyri, 6893 Vik i Sogn" },
  { name: "TINE Meieriet Ørsta", category: "tine", status: "drift", address: "Voldavegen 2, 6155 Ørsta" },
  { name: "TINE Meieriet Ålesund", category: "tine", status: "drift", address: "Klaus Nilsens gate 14, 6003 Ålesund" },
];

// Startdatasett, du kan legge inn flere via CSV
const START_FARMS = [
  // Eksempler fra tidligere, med koordinater
  { name: "Skolås Gard", category: "storfe", status: "drift", lat: 59.39, lon: 8.02, note: "Vinje" },
  { name: "Nigard Bratterud", category: "storfe", status: "ukjent", lat: 59.51456, lon: 7.99531, note: "Tokke" },
  { name: "Uppistog Bratterud", category: "storfe", status: "ukjent", lat: 59.5156, lon: 7.9972, note: "Tokke" },
  { name: "Sypriansen småbruk", category: "begge", status: "drift", lat: 59.307, lon: 9.11, note: "Midt Telemark" },
];

function normalize(s) {
  return (s || "").toString().trim();
}

function parseCSV(text) {
  // Forventet kolonner, name,category,status,address,lat,lon,note
  // Separator, komma eller semikolon
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const sep = lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";
  const header = lines[0].split(sep).map(h => h.trim().toLowerCase());
  const idx = (k) => header.indexOf(k);

  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(c => c.trim());
    const item = {
      name: cols[idx("name")] ?? cols[0],
      category: (cols[idx("category")] ?? "").toLowerCase() || "storfe",
      status: (cols[idx("status")] ?? "").toLowerCase() || "ukjent",
      address: cols[idx("address")] || "",
      lat: cols[idx("lat")] ? Number(cols[idx("lat")]) : undefined,
      lon: cols[idx("lon")] ? Number(cols[idx("lon")]) : undefined,
      note: cols[idx("note")] || "",
    };
    if (!item.name) continue;
    if (!ICONS[item.category]) item.category = "storfe";
    if (!["drift", "ukjent"].includes(item.status)) item.status = "ukjent";
    out.push(item);
  }
  return out;
}

async function geocodeNominatim(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!res.ok) return null;
  const json = await res.json();
  if (!json?.length) return null;
  return { lat: Number(json[0].lat), lon: Number(json[0].lon) };
}

function useGeocode(items) {
  const [resolved, setResolved] = useState(() => items);
  const queueRef = useRef([]);
  const busyRef = useRef(0);

  useEffect(() => {
    setResolved(items);
  }, [items]);

  useEffect(() => {
    const key = "farmmap_geocode_cache_v1";
    const cache = JSON.parse(localStorage.getItem(key) || "{}");

    const need = resolved
      .map((it, idx) => ({ it, idx }))
      .filter(({ it }) => !it.lat && !it.lon && it.address);

    queueRef.current = need;

    const pump = async () => {
      if (busyRef.current >= 2) return;
      const next = queueRef.current.shift();
      if (!next) return;

      const { it, idx } = next;
      const a = it.address;

      if (cache[a]) {
        const { lat, lon } = cache[a];
        setResolved(prev => {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], lat, lon };
          return copy;
        });
        pump();
        return;
      }

      busyRef.current++;
      try {
        const hit = await geocodeNominatim(a);
        if (hit) {
          cache[a] = hit;
          localStorage.setItem(key, JSON.stringify(cache));
          setResolved(prev => {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], ...hit };
            return copy;
          });
        }
      } catch (e) {
        // ignorer
      } finally {
        busyRef.current--;
        setTimeout(pump, 250);
      }
    };

    // start noen arbeidere
    pump();
    pump();
  }, [resolved]);

  return resolved;
}

export default function NorgeKart() {
  const [showCategories, setShowCategories] = useState({ storfe: true, svin: true, begge: true, tine: true });
  const [showStatus, setShowStatus] = useState({ drift: true, ukjent: true });
  const [search, setSearch] = useState("");
  const [csvText, setCsvText] = useState("name,category,status,address,lat,lon,note\nEksempel gård,storfe,drift,,63.43,10.39,Trondheim\nEksempel gård 2,svin,ukjent,Gate 1, 0001 Oslo,,,");

  const [customItems, setCustomItems] = useState([]);
  useEffect(() => {
  fetch("/datasett.csv")
    .then(res => res.text())
    .then(text => {
      const items = parseCSV(text);
      const importCSV = () => {
  fetch("/datasett.csv?v=5")
    .then(res => res.text())
    .then(text => {
      const items = parseCSV(text);
      console.log("CSV loaded:", items.length);
      setCustomItems(items);
    })
    .catch(err => console.error(err));
};
    });
}, []);

  const allItems = useMemo(() => {
    return [
      ...TINE_SITES.map(x => ({ ...x })),
      ...START_FARMS.map(x => ({ ...x })),
      ...customItems.map(x => ({ ...x })),
    ];
  }, [customItems]);

  const resolved = useGeocode(allItems);

  const filtered = useMemo(() => {
    const q = normalize(search).toLowerCase();
    return resolved.filter(it => {
      if (!showCategories[it.category]) return false;
      if (!showStatus[it.status]) return false;
      if (q && !(it.name || "").toLowerCase().includes(q) && !(it.address || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [resolved, showCategories, showStatus, search]);

  const markers = filtered.filter(it => typeof it.lat === "number" && typeof it.lon === "number");
  const missingGeo = filtered.filter(it => !(typeof it.lat === "number" && typeof it.lon === "number") && it.address);

  const counts = useMemo(() => {
    const c = { storfe: 0, svin: 0, begge: 0, tine: 0, drift: 0, ukjent: 0 };
    for (const it of resolved) {
      c[it.category] = (c[it.category] || 0) + 1;
      c[it.status] = (c[it.status] || 0) + 1;
    }
    return c;
  }, [resolved]);

  const importCSV = () => {
    const items = parseCSV(csvText);
    setCustomItems(items);
  };

  const exportCSV = () => {
    const rows = ["name,category,status,address,lat,lon,note"];
    for (const it of resolved) {
      rows.push([
        JSON.stringify(it.name || ""),
        it.category || "",
        it.status || "",
        JSON.stringify(it.address || ""),
        it.lat ?? "",
        it.lon ?? "",
        JSON.stringify(it.note || ""),
      ].join(","));
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kartdata.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full h-[750px] grid grid-cols-1 lg:grid-cols-3 gap-3">
      <div className="lg:col-span-1 rounded-2xl shadow-sm border bg-white p-3 overflow-auto">
        <div className="text-xl font-semibold">Norgekart, storfe, svin, TINE</div>
        <div className="text-sm text-slate-600 mt-1">Filtrer lag, søk, lim inn CSV, TINE punkter geokodes fra adresse</div>

        <div className="mt-4">
          <div className="text-sm font-semibold mb-2">Søk</div>
          <input value={search} onChange={e => setSearch(e.target.value)} className="w-full rounded-xl border px-3 py-2" placeholder="Søk navn eller adresse" />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <div className="text-sm font-semibold mb-2">Kategori</div>
            {[
              { k: "storfe", label: `🐄 Storfe (${counts.storfe})` },
              { k: "svin", label: `🐖 Svin (${counts.svin})` },
              { k: "begge", label: `🐄🐖 Begge (${counts.begge})` },
              { k: "tine", label: `🥛 TINE anlegg (${counts.tine})` },
            ].map(x => (
              <label key={x.k} className="flex items-center gap-2 text-sm mb-1">
                <input type="checkbox" checked={showCategories[x.k]} onChange={e => setShowCategories(s => ({ ...s, [x.k]: e.target.checked }))} />
                <span>{x.label}</span>
              </label>
            ))}
          </div>
          <div>
            <div className="text-sm font-semibold mb-2">Status</div>
            {[
              { k: "drift", label: `I drift (${counts.drift})` },
              { k: "ukjent", label: `Ukjent (${counts.ukjent})` },
            ].map(x => (
              <label key={x.k} className="flex items-center gap-2 text-sm mb-1">
                <input type="checkbox" checked={showStatus[x.k]} onChange={e => setShowStatus(s => ({ ...s, [x.k]: e.target.checked }))} />
                <span>{x.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">CSV import</div>
            <div className="flex gap-2">
              <button onClick={importCSV} className="px-3 py-1 rounded-xl bg-slate-900 text-white text-sm">Importer</button>
              <button onClick={exportCSV} className="px-3 py-1 rounded-xl bg-slate-200 text-sm">Eksporter</button>
            </div>
          </div>
          <div className="text-xs text-slate-600 mt-1">Kolonner, name, category(storfe|svin|begge|tine), status(drift|ukjent), address, lat, lon, note</div>
          <textarea value={csvText} onChange={e => setCsvText(e.target.value)} className="w-full h-36 mt-2 rounded-xl border p-2 font-mono text-xs" />
        </div>

        <div className="mt-4">
          <div className="text-sm font-semibold">Punkter på kart</div>
          <div className="text-sm text-slate-700">Vises nå, {markers.length} punkter</div>
          {missingGeo.length > 0 && (
            <div className="text-xs text-amber-700 mt-1">Jobber med geokoding, {missingGeo.length} adresser uten koordinater ennå</div>
          )}
        </div>

        <div className="mt-4">
          <div className="text-sm font-semibold">Tips</div>
          <div className="text-sm text-slate-700">
            For Norge, komplett liste over alle gårder med dyreslag er normalt ikke tilgjengelig som åpent kartdatasett, bruk CSV import for dine lister, eller legg inn mottakere du jobber med.
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 rounded-2xl shadow-sm border overflow-hidden">
        <MapContainer
  center={NORWAY_CENTER}
  zoom={4}
  style={{ height: "750px", width: "100%" }}
>
          <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {markers.map((it, idx) => (
            <Marker key={`${it.name}-${idx}`} position={[it.lat, it.lon]} icon={ICONS[it.category] || ICONS.storfe}>
              <Popup>
                <div className="text-sm">
                  <div className="font-semibold">{it.name}</div>
                  <div className="mt-1">{it.category === "tine" ? "🥛 TINE" : it.category === "begge" ? "🐄🐖 Storfe og svin" : it.category === "svin" ? "🐖 Svin" : "🐄 Storfe"}</div>
                  <div className="mt-1">Status, {it.status === "drift" ? "i drift" : "ukjent"}</div>
                  {it.address && <div className="mt-1">Adresse, {it.address}</div>}
                  {it.note && <div className="mt-1">Notat, {it.note}</div>}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
