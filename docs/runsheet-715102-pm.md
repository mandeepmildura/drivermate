# Shift 715102 — PM Run (Route 712)

**Source:** Printed run sheet, MIL2025-MilVicSD-5.00, printed 20/01/2026 11:50
**Effective from:** Tuesday 27 January 2026
**Days:** Weekdays / school days only
**Block:** MVSD23 (Standard Bus)

> Companion to [runsheet-715102-am.md](./runsheet-715102-am.md). Same shift, second half of the day. This document is the canonical source of truth for what shift 715102 PM should look like. Compare against `routes` row `route_number = '715102-PM'` and its `route_stops` in Supabase whenever data drifts.

---

## Shift envelope (PM half only — see AM doc for the morning)

| Item | Time |
|---|---|
| WAD2 yard duty (Mildura Depot) | 12:30 → 15:05 |
| Dead run depot → Our Lady of the Sacred Heart | 15:05 → 15:30 |
| **Service starts** | **15:30** (depart OL Sacred Heart) |
| **Service ends** | **16:10** (final drop at Deakin & Eleventh) |
| Dead run last stop → depot | 16:10 → 16:28 |
| Sweep bus, empty bins, sign-off | → 16:38 |

PM service is the *reverse direction* of the AM run: in the morning the bus picks up Mildura kids and drops them at Merbein P-10 / Our Lady; in the afternoon it collects from Our Lady → Merbein → Stadium and drops kids back in central Mildura at Deakin & Eleventh.

---

## Service section: 4 scheduled stops

| # | Stop name | Sched | Notes |
|---|---|---|---|
| 1 | Our Lady of the Sacred Heart | 15:30 | Position at 15:25, depart at 15:30 |
| 2 | Merbein P-10 College | 15:38 | Co-ord with Shift 5 / D27 — direct Flora Avenue & Eighth Street passengers to **733 (MR5)** |
| 3 | St Joseph's College Stadium | 15:55 | |
| 4 | Deakin St & Eleventh St | 16:10 | Final drop — walk through bus + declare "no children left" |

---

## Turn-by-turn (full nav, between every stop)

The yellow-highlighted block on the run sheet is the source. The printed sequence has **at least three known errors** in the Mildura legs (Mandeep verified on the road) — corrections marked inline. Times in **bold** are checkpoints called out on the printed sheet.

### Leg 0 — Dead run: Depot → Our Lady of the Sacred Heart (15:05 → 15:30)

Not captured in `route_stops` yet — the dead run from Mildura Depot west through Calder Hwy to Merbein takes ~25 minutes and follows the same arterial route as the AM return leg in reverse. Add later if drivers need turn-by-turn for the dead run too.

### Leg 1 — Stop 1 → Stop 2: OL Sacred Heart → Merbein P-10 (15:30 → 15:38)

1. **15:30** Depart Our Lady of the Sacred Heart
2. Left into **Surgey Street** *(verified street name — OSRM-confirmed, 0.37 m snap)*
3. Left into Commercial Street (Merbein)
4. **15:33** Right into Park Street
5. Position at Merbein P-10 College in Park Street

### Leg 2 — Stop 2 → Stop 3: Merbein P-10 → St Joseph's Stadium (15:38 → 15:55)

6. **15:38** Depart Merbein P-10 (continue on Park Street)
7. Right into Game Street
8. Right into Mead Street
9. Right into Commercial Road
10. *(into)* Reilly Street *(direction not printed; AM sheet has the reverse turn as "right" → PM is left/straight depending on entry angle)*
11. *(continue on)* Ranfurly Way / Flora Avenue *(road-name change, no actual turn)*
12. **Right into Eleventh Street** *(missing from printed sheet — added by Mandeep)*
13. **Left into Dyar Avenue** *(printed sheet wrongly says "right")*
14. **Right into Eighth Street** *(printed sheet wrongly says "left"; Dyar/Eighth corner)*
15. Right into Riverside Avenue

### Leg 3 — Stop 3 → Stop 4: Stadium → Deakin & Eleventh (15:55 → 16:10)

16. **15:55** Pickup at St Joseph's College Stadium
17. Left into Twelfth Street
18. Left into Ontario Avenue
19. **Right into Eleventh Street** *(missing from printed sheet — added by Mandeep)*
20. **Right into Walnut Avenue** *(printed sheet wrongly says "left")*
21. Left into 14th Street
22. ★ **16:10** — Stop 4: **Deakin St & Eleventh St** (final drop, walk-through declaration)

### Leg 4 — Dead run: Final drop → Depot (16:10 → 16:28)

23. Left into Deakin Avenue
24. Right into 11th Street
25. Right into Cowra Avenue *(implied — not pinned as a waypoint yet)*
26. → Mildura Depot 16:28 → sweep, empty bins → 16:38 sign-off

---

## Timing checkpoint summary

| Time | Where you should be |
|---|---|
| 15:25 | Position at Our Lady of the Sacred Heart |
| 15:30 | Departing Our Lady of the Sacred Heart |
| 15:33 | Turning right into Park Street |
| 15:38 | Departing Merbein P-10 College |
| 15:55 | Pickup at St Joseph's College Stadium |
| 16:10 | Final drop at Deakin & Eleventh St |
| 16:28 | Back at Mildura Depot |
| 16:38 | Sign-off |

---

## Run sheet errors confirmed by Mandeep

The printed Mildura legs have the same family of left/right reversals + missing turns as the AM Merbein leg. Verified on the road during PM testing on 2026-04-27:

- **Leg 2 between Ranfurly/Flora and Dyar:** the printed sheet skips the *Right into Eleventh Street* turn entirely. Bus actually does Ranfurly → Eleventh → Dyar.
- **Leg 2 Dyar Avenue direction:** printed sheet says "right", actually **left** from Eleventh.
- **Leg 2 Eighth Street direction:** printed sheet says "left", actually **right** at the Dyar/Eighth corner.
- **Leg 3 between Ontario and Walnut:** printed sheet skips the *Right into Eleventh Street* turn entirely. Bus actually does Ontario → Eleventh → Walnut.
- **Leg 3 Walnut Avenue direction:** printed sheet says "left", actually **right** from Eleventh.

Coords are in [runsheet-715102-pm-coords.md](./runsheet-715102-pm-coords.md).

---

## Counter semantics

PM run is mostly drop-only — kids board at the Merbein/OL Sacred Heart end and alight in Mildura. Per CLAUDE.md, every stop is a request-stop:

- 0 pickups at Merbein / Stadium is a normal case (no kids waiting that day).
- The auto-advance fix (PR #1) handles drive-pasts: if the bus crosses a stop coord without dwelling 8 s, the stop auto-logs with `pickup_count = 0`.
- The end-of-run point (`-34.20275, 142.17331`) is a generic "service ended" marker so the auto-advance terminates cleanly before the dead-run home.

---

## What's currently in the DB vs this sheet

| Element | DB has it? | Notes |
|---|---|---|
| Route row `715102-PM` | Pre-existed | Description / version bumped by `0003_seed_715102_pm.sql` |
| 4 scheduled stops with times | ✅ Yes | Stops + times match exactly |
| `path_geojson` LineString | ✅ Yes | OSRM road-following, 19.71 km / 27 min, 687 points (turn 2.4 omitted from line because it caused a school-grounds backtrack — see comment in seed migration) |
| Turn-by-turn waypoints (kind='turn') | ✅ Yes | All 20 turn waypoints from this doc seeded |
| Timed turn waypoint (15:33 right into Park Street) | ✅ Yes | `scheduled_time` = 15:33 on the Park Street turn row |
| Coordination notes ("co-ord with Shift 5 / D27", "direct Flora/Eighth passengers to 733") | ✅ Yes | In `instruction_text` on Stop 2 |
| "No children left" declaration | ❌ No | App has no end-of-run sign-off step (same gap as AM) |
| Sign-on / sign-off / WAD2 / meal break | ❌ No | Out of scope of current data model (same as AM) |

---

## Data model summary (current `route_stops` for PM)

```
route_id = lookup by route_number = '715102-PM'
sequence | kind | scheduled_time | stop_name
---------+------+----------------+---------------------------------------
   1     | stop |   15:30:00     | Our Lady of the Sacred Heart
   2     | turn |                | Left into Surgey Street
   3     | turn |                | Left into Commercial Street (Merbein)
   4     | turn |   15:33:00     | Right into Park Street
   5     | stop |   15:38:00     | Merbein P-10 College
   6     | turn |                | Right into Game Street
   7     | turn |                | Right into Mead Street
   8     | turn |                | Right into Commercial Road
   9     | turn |                | Reilly Street
  10     | turn |                | Ranfurly Way / Flora Avenue
  11     | turn |                | Right into Eleventh Street
  12     | turn |                | Left into Dyar Avenue
  13     | turn |                | Right into Eighth Street
  14     | turn |                | Right into Riverside Avenue
  15     | stop |   15:55:00     | St Joseph's College Stadium
  16     | turn |                | Left into Twelfth Street
  17     | turn |                | Left into Ontario Avenue
  18     | turn |                | Right into Eleventh Street
  19     | turn |                | Right into Walnut Avenue
  20     | turn |                | Left into 14th Street
  21     | stop |   16:10:00     | Deakin St & Eleventh St (final drop)
  22     | turn |                | Left into Deakin Avenue
  23     | turn |                | Right into 11th Street
  24     | turn |                | End of service
```
