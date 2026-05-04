# DriverMate

Hands-free turn-by-turn navigation + passenger counter PWA for **CDC Mildura** school bus drivers. Offline-first, tablet-portrait, no app store.

**Primary audience:** NEW drivers who don't know the route yet. Every design decision optimizes for "driver has never driven this run before." Experienced drivers are a secondary audience.

**Live at:** https://drivermate.pages.dev (Cloudflare Pages)

## Tech stack

| Layer | Tech |
|---|---|
| App shell | Vite + React + TypeScript |
| Styling | Tailwind CSS |
| Map | MapLibre GL JS + OSM tiles (embedded, not deep-links) |
| Geo math | Turf.js |
| Offline storage | Dexie.js (IndexedDB) |
| PWA | vite-plugin-pwa (Workbox) |
| Auth + DB | Supabase (Postgres) |
| Voice | Web Speech API (`speechSynthesis`) |
| Hosting | Cloudflare Pages |

## Key rules

- **Run screen is map-first.** Never revert to Google Maps deep-links — that was an early wrong turn, corrected 2026-04-24.
- **Audio is distance-based** (≤150m to next waypoint), not time-based.
- **Drivers are read-only for routes.** Only admins can edit. Routes must be locked before driver use.
- **Stops are request-stops by default.** The scheduled list is a sequence of checkpoints, not guaranteed halts — drivers only physically stop if kids are waiting. Counter logic and "on-time" banding must reflect this.
- **Compliance:** Vic Bus Safety Regulation 31 — 3-year retention on `shifts`, `stop_events`, `gps_breadcrumbs`.
- **Never hands-required while moving.** If a feature forces the driver to touch the screen mid-drive, it's wrong.

## Data model highlights

- `route_stops` unifies turns and stops via `kind: 'stop' | 'turn'`
  - `turn` = nav waypoint with `instruction_text`, no passenger counter
  - `stop` = scheduled stop with `scheduled_time` and passenger count
- Pickup counts are **per-stop** (logged when GPS dwell completes), not per individual tap
- Route line is derived client-side from sequential lat/lng; Phase 9 admin editor will add proper road-following geometry

## Build phases

1. Scaffolding ✅
2. Data layer (Supabase + Dexie) ✅
3. Auth + route picker ✅
4. Run screen ✅
5. Audio (Web Speech) ✅
6. Admin route editor (partial)
7. Offline sync ✅
8. Real route 715102 seeded ✅
9. **Next:** full admin route editor with road-following geometry

## Supabase

- **Project URL:** `https://aikjhswwmluxzejfsdrw.supabase.co`
- **Project ref:** `aikjhswwmluxzejfsdrw`
- Migrated off the shared FarmControl/irrigation project (`lecssjvuskqemjzvjimo`) to a dedicated account. The old project still exists but is dev-only — do not query it for production state.

`.env.local` holds `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` — gitignored. Service-role key stays in the Supabase dashboard, never in code.

## Workflow

- Driver PWA: tablet-portrait, large tap targets, high contrast for daylight cabin.
- GPS auto-advance: 50 m geofence + 8 s dwell. Manual "Stop reached" button as fallback.
- Offline: Dexie queue drains on reconnect. Tab refresh survives.
- Deploys: push to `main` → Cloudflare Pages builds automatically.
