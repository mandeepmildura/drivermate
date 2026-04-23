# DriverMate

Hands-free turn-by-turn navigation and passenger counter for **CDC Mildura** school bus drivers. Built as an offline-first Progressive Web App so it runs on any tablet — no app store, no install friction, no dependence on rural mobile coverage during a run.

> **Status:** Phase 1 of 8 — project scaffolding.

## Why

CDC Mildura drivers currently work from paper shift sheets. DriverMate digitises the same workflow with three goals:

1. **Safety** — audio-only turn-by-turn instructions, no touch required while moving.
2. **Compliance** — every shift produces a digital audit trail aligned with the Bus Safety Regulations 2020 record-keeping requirements (3-year retention).
3. **Operations** — synced passenger counts and arrival times give the depot real-time visibility into each route.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| App shell | Vite + React + TypeScript | Type-safe; fast iteration for a safety-adjacent app |
| Styling | Tailwind CSS | Tablet-portrait, high contrast, glanceable in a moving cabin |
| Auth + DB + sync | Supabase (Postgres) | Row-level security for driver data; existing CDC tooling |
| Offline storage | Dexie.js (IndexedDB) | Survives tab close and device restart |
| PWA | vite-plugin-pwa (Workbox) | Installable on any modern tablet over HTTPS |
| Voice | Web Speech API (`speechSynthesis`) | Built into every browser; works fully offline; zero cost |
| Hosting | Cloudflare Pages | Global CDN, free tier, integrates with existing CDN setup |

## Build phases

1. **Scaffolding** ← *current*
2. Data layer — Supabase schema + Dexie sync queue
3. Auth + route picker + bus confirmation
4. Run screen — stop sequence, passenger counter, on-time banding
5. Audio — Web Speech API with 30-second lookahead
6. Admin route editor (lock/unlock for compliance)
7. Full offline sync test
8. Seed real route 715102 from the depot shift sheet

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Add Supabase credentials
cp .env.local.example .env.local
# then edit .env.local with your VITE_SUPABASE_ANON_KEY

# 3. Run the dev server
npm run dev
```

Open http://localhost:5173 — the app should redirect to `/login`.

To preview on a real tablet on the same Wi-Fi:

```bash
npm run dev -- --host
```

…then visit `http://<your-laptop-IP>:5173` on the tablet. Note that `speechSynthesis` and PWA install both require HTTPS in production; deploy a preview to Cloudflare Pages to test those properly.

## GPS auto-advance

The Run screen reads the tablet's GPS (HTML5 geolocation, no API key) and automatically logs each stop once the bus has been within **50 m of the stop's lat/lng for 8 seconds**. Visual feedback:

- Header GPS badge: shows current distance to the next stop, or one of `denied` / `waiting…` / `unsupported`. Tap to disable / re-enable.
- "Approaching · 180 m to go" banner while within 200 m.
- "Arrived. Auto-logging in 6s — keep counting." banner while within 50 m.

The driver can still tap **Stop reached** manually if GPS is unavailable or if they want to log early. Auto-logged stops carry a `note = 'auto-advanced via GPS geofence'` so admin reports can distinguish them.

GPS auto-advance is a no-op until each stop has lat/lng populated — set those via `/admin → route → stop → Latitude/Longitude` (right-click the stop in Google Maps → "What's here?" gives you the coords).

## Offline test plan (Phase 7)

DriverMate is offline-first. To verify the full loop:

1. Sign in while online and pick a route. The route, its stops and the bus list will be cached in IndexedDB (`drivermate` database) on first fetch.
2. In Chrome DevTools → Network, switch the throttling profile to **Offline**. The header in the Run screen flips from "Online" to "Offline".
3. Walk through the run as normal — every "Stop reached" tap and the final "End run" enqueues a mutation in `drivermate.pending`.
4. Switch back to "Online". Within 30 seconds (or immediately on the `online` event) the pending queue drains; the badge reverts to "Online" and `pending` returns to 0.
5. Hard-refresh the tab while still mid-run — the active shift, all logged stops, the running total and the pending queue all survive (Dexie persists across tab restarts).

If a row fails to upload, it stays in `pending` with `attempts` incremented and `last_error` populated. After 5 attempts it is held until the next manual sync from the End-of-run screen.

## Compliance notes

- `shifts` and `stop_events` tables are designed for **3-year retention** per Vic Bus Safety Regulation 31.
- Routes are **admin-editable, driver-read-only**. Drivers cannot mutate routing data mid-shift.
- Passenger counts function as a duty-of-care record (the existing "no children left on bus" check, digitised).

## Project layout

```
src/
  lib/
    supabase.ts          # Lazy Supabase client
  routes/
    Login.tsx
    RoutePicker.tsx
    BusConfirm.tsx
    Run.tsx              # The hands-free driver view
    EndOfRun.tsx
    Admin.tsx            # Route editor (admin-only)
  App.tsx
  main.tsx
  index.css              # Tailwind layers + driver-cabin component classes
```
