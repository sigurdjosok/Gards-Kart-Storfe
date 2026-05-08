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
  storfe: emojiIcon("🐂", "#fbcfe8"),
  tine: emojiIcon("🏭", "#bfdbfe"),
};

function normalize(s) {
  return (s || "").toString().trim();
}

function parseCSV(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const first = lines[0].replace(/^\uFEFF/, "");
  const sep = first.includes(";") ? ";" : ",";

  const header = first.split(sep).map((h) => h.trim().toLowerCase());
  const idx = (k) => header.indexOf(k);

  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map((c) => c.trim());

    const name =
      (idx("name") >= 0 ? cols[idx("name")] : "") ||
      (cols.length >= 2 ? cols[1] : "") ||
      "";

    const address =
      (idx("address") >= 0 ? cols[idx("address")] : "") ||
      (cols.length >= 3 ? cols[2] : "") ||
      "";

    if (!name || !address) continue;

    out.push({
      name,
      category: "storfe",
      status: "drift",
      address,
      lat: undefined,
      lon: undefined,
    });
  }

  return out;
}

const TINE_ANLEGG = [
  { name: "TINE Meieriet Alta", address: "Meieriveien 5, 9510 Alta" },
  { name: "TINE Meieriet Sandnessjøen", address: "Alstenveien 51, Sandnessjøen" },
  { name: "TINE Meieriet Storsteinnes", address: "Meieriveien 21, 9050 Storsteinnes" },
  { name: "TINE Meieriet Tana", address: "Grenveien 7, 9845 Tana" },
  { name: "TINE Meieriet Selbu", address: "Selbuvegen 1234, 7580 Selbu" },
  { name: "TINE Meieriet Sømna", address: "Saltnesodden 3, 8920 Sømna" },
  { name: "TINE Meieriet Tunga (Trondheim)", address: "Bromstadvegen 68, 7047 Trondheim" },
  { name: "TINE Meieriet Verdal", address: "Melkevegen 1, 7652 Verdal" },
  { name: "TINE Meieriet Bergen", address: "Espehaugen 18, 5258 Blomsterdalen" },
  { name: "TINE Meieriet Byrkjelo", address: "Meierivegen 1, 6826 Byrkjelo" },
  { name: "TINE Meieriet Elnesvågen", address: "Sjøvegen 4, 6440 Elnesvågen" },
  { name: "TINE Meieriet Tresfjord", address: "Sylteøvrane 3, 6391 Tresfjord" },
  { name: "TINE Meieriet Vik", address: "Vikøyri, 6893 Vik i Sogn" },
  { name: "TINE Meieriet Ørsta", address: "Voldavegen 2, 6155 Ørsta" },
  { name: "TINE Meieriet Ålesund", address: "Klaus Nilsens gate 14, Ålesund" },
  { name: "TINE Meieriet Brumunddal", address: "Strandsagvegen 1, 2383 Brumunddal" },
  { name: "TINE Meieriet Dovre", address: "Stasjonsvegen 10, 2662 Dovre" },
  { name: "TINE Meieriet Frya", address: "Fryavegen 64, 2630 Ringebu" },
  { name: "TINE Meieriet Lom og Skjåk", address: "Skjåkvegen 8, Skjåk" },
  { name: "TINE Meieriet Tretten", address: "Musdalsvegen 34, 2635 Tretten" },
  { name: "TINE Meieriet Trysil", address: "Parkvegen 8, 2422 Nybergsund" },
  { name: "TINE Meieriet Oslo Kalbakken", address: "Bedriftsveien 7, 0950 Oslo" },
  { name: "TINE Meieriet Haukeli", address: "Storegutvegen 165, Edland" },
  { name: "TINE Meieriet Jæren", address: "Næringsvegen 21, 4365 Nærbø" },
  { name: "TINE Meieriet Setesdal", address: "Setesdalsvegen 2019, 4741 Byglandsfjord" },
].map((a) => ({
  ...a,
  category: "tine",
  status: "anlegg",
  lat: undefined,
  lon: undefined,
}));

async function geocodeNominatim(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    address
  )}&limit=1`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;
  const json = await res.json();
  if (!json?.length) return null;
  return { lat: Number(json[0].lat), lon: Number(json[0].lon) };
}

function useGeocode(items) {
  const [resolved, setResolved] = useState(items);
  const queueRef = useRef([]);
  const busyRef = useRef(0);

  useEffect(() => {
    setResolved(items);
  }, [items]);

  useEffect(() => {
    const key = "farmmap_geocode_cache_v1";
    const cache = JSON.parse(localStorage.getItem(key) || "{}");

    const need = items
      .map((it, idx) => ({ it, idx }))
      .filter(
        ({ it }) =>
          !(typeof it.lat === "number" && typeof it.lon === "number") &&
          it.address
      );

    queueRef.current = need;

    const pump = async () => {
      if (busyRef.current >= 2) return;
      const next = queueRef.current.shift();
      if (!next) return;

      const { it, idx } = next;
      const a = it.address;

      if (cache[a]) {
        const { lat, lon } = cache[a];
        setResolved((prev) => {
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
          setResolved((prev) => {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], ...hit };
            return copy;
          });
        }
      } catch (e) {
      } finally {
        busyRef.current--;
        setTimeout(pump, 250);
      }
    };

    pump();
    pump();
  }, [items]);

  return resolved;
}

export default function NorgeKartSvin() {
  const [search, setSearch] = useState("");
  const [customItems, setCustomItems] = useState([]);
  const [loadInfo, setLoadInfo] = useState("");

  useEffect(() => {
    const url = `${window.location.origin}/storfe.csv?v=${Date.now()}`;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Kunne ikke hente storfe.csv");
        return res.text();
      })
      .then((text) => {
        const storfeItems = parseCSV(text);
        const all = [...TINE_ANLEGG, ...storfeItems];
        setCustomItems(all);
        setLoadInfo(
          `Lastet ${storfeItems.length} storfebønder, ${TINE_ANLEGG.length} TINE anlegg`
        );
      })
      .catch((err) => {
        setLoadInfo(`Feil: ${err.message}`);
      });
  }, []);

  const resolved = useGeocode(customItems);

  const filtered = useMemo(() => {
    const q = normalize(search).toLowerCase();
    return resolved.filter((it) => {
      if (
        q &&
        !(it.name.toLowerCase().includes(q) ||
          it.address.toLowerCase().includes(q))
      )
        return false;
      return true;
    });
  }, [resolved, search]);

  const markers = filtered.filter(
    (it) => typeof it.lat === "number" && typeof it.lon === "number"
  );

  return (
    <div className="w-full h-[750px] grid grid-cols-1 lg:grid-cols-3 gap-3">
      <div className="lg:col-span-1 p-3">
        <div className="text-xl font-semibold">🐂 Storfebønder, 🏭 TINE anlegg</div>
        <div className="text-sm mt-1">{loadInfo}</div>

        <input
          className="w-full mt-3 border p-2"
          placeholder="Søk..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="lg:col-span-2">
        <MapContainer
          center={NORWAY_CENTER}
          zoom={4}
          style={{ height: "750px", width: "100%" }}
        >
          <TileLayer
            attribution="© OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {markers.map((it) => (
            <Marker
              key={`${it.category}:${it.name}:${it.address}`}
              position={[it.lat, it.lon]}
              icon={ICONS[it.category] || ICONS.storfe}
            >
              <Popup>
                <b>{it.name}</b>
                <br />
                {it.address}
                <br />
                <span style={{ opacity: 0.75 }}>
                  {it.category === "tine" ? "TINE anlegg" : "Storfebonde"}
                </span>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
