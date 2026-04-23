// One-off: hit Nominatim (free OSM geocoder) for each stop in route 715102
// and print SQL UPDATEs to stdout. Polite — 1.2 s between calls.

const UA = 'DriverMate/0.1 (mandeep@freshoz.com)';

// Each entry tries several queries until one returns a hit
const queries = [
  {
    match: 'Eleventh St / Benetook Ave',
    tries: [
      '11th Street and Benetook Avenue, Mildura, Victoria, Australia',
      'Benetook Avenue, Mildura, Victoria, 3500, Australia',
    ],
  },
  {
    match: "St Joseph's College / Twelfth Ave",
    tries: ["St Joseph's College, Twelfth Street, Mildura, Victoria, Australia"],
  },
  {
    match: 'Mildura Senior College / 14th St',
    tries: [
      'Mildura Senior College, Mildura, Victoria, Australia',
      'Mildura Senior Secondary College, Deakin Avenue, Mildura, Victoria, Australia',
    ],
  },
  {
    match: "St Joseph's Stadium",
    tries: [
      "St Joseph's College, Riverside Avenue, Mildura, Victoria, Australia",
      'Riverside Avenue, Mildura, Victoria, 3500, Australia',
    ],
  },
  {
    match: "St Joseph's College Stadium",
    tries: [
      "St Joseph's College, Riverside Avenue, Mildura, Victoria, Australia",
      'Riverside Avenue, Mildura, Victoria, 3500, Australia',
    ],
  },
  {
    match: 'Merbein P-10 College',
    tries: ['Merbein P-10 College, Merbein, Victoria, Australia'],
  },
  {
    match: 'Our Lady of the Sacred Heart',
    tries: ['Our Lady of the Sacred Heart, Merbein, Victoria, Australia'],
  },
  {
    match: 'Deakin St & Eleventh St',
    tries: [
      'Deakin Avenue and Eleventh Street, Mildura, Victoria, Australia',
      'Deakin Avenue, Mildura, Victoria, 3500, Australia',
    ],
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function geocode(q) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=au`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  return res.json();
}

for (const { match, tries } of queries) {
  let hit = null;
  for (const q of tries) {
    const data = await geocode(q);
    await sleep(1200);
    if (data?.[0]) {
      hit = { ...data[0], queriedAs: q };
      break;
    }
  }
  if (!hit) {
    console.error(`-- MISS: ${match}  (no candidate)`);
    continue;
  }
  console.log(`-- ${match}  →  ${hit.display_name}`);
  const matchEsc = match.replace(/'/g, "''");
  console.log(
    `UPDATE drivermate.route_stops SET lat = ${hit.lat}, lng = ${hit.lon} WHERE stop_name = '${matchEsc}';`,
  );
}
