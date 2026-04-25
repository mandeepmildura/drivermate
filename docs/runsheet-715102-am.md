# Shift 715102 — AM Run (Route 712)

**Source:** Printed run sheet, MIL2025-MilVicSD-5.00, printed 20/01/2026 11:50
**Effective from:** Tuesday 27 January 2026
**Days:** Weekdays / school days only
**Block:** MVSD23 (Standard Bus)

> This document is the canonical source of truth for what shift 715102 AM should look like. Compare against `routes` row `route_number = '715102-AM'` and its `route_stops` in Supabase whenever data drifts.

---

## Shift envelope

| Item | Time |
|---|---|
| Sign-on | 07:38 |
| Dead run depot → first stop | 07:48 → 07:50 |
| **Service starts** | **07:50** |
| **Service ends** | **08:48** |
| Dead run last stop → depot | 08:48 → 09:12 |
| WAD2 yard duty (Mildura Depot) | 09:12 → 11:30 |
| Meal break (Mildura Depot) | 11:30 → 12:30 |
| (PM run starts at 12:30) | — |
| Sign-off | 16:38 |
| Total work hours | 8h00 |

---

## Service section: 6 scheduled stops

These are the only entries with a `scheduled_time` in the timetable column. They map 1:1 with the current DB rows.

| # | Stop name | Sched | Notes |
|---|---|---|---|
| 1 | Eleventh St / Benetook Ave | 07:50 | First pickup |
| 2 | St Joseph's College / Twelfth Ave | 08:13 | |
| 3 | Mildura Senior College / 14th St | 08:18 | Also serves Chaffey Secondary |
| 4 | St Joseph's Stadium | 08:30 | **Co-ord with D11.** Koorlong students transfer here for Merbein P-10 (kids can board AND alight) |
| 5 | Merbein P-10 College | 08:42 | |
| 6 | Our Lady of the Sacred Heart | 08:48 | Final drop. Walk through bus + declare "no children left". |

---

## Turn-by-turn (full nav, between every stop)

The yellow highlighted block on the run sheet contains every turn. Below, each turn is grouped under the leg of the journey it falls in. Any line with a **time** is a timed waypoint the driver must hit (delays here mean the next scheduled stop will slip).

### Leg 0 — Dead run: Depot → Eleventh St / Benetook Ave (07:48 → 07:50)
- **07:48** Depart depot
- Left into Bathurst Court
- Left into Cowra Avenue
- Left into Eleventh Street
- **07:50** Arrive Eleventh St / Benetook Ave — *first pickup*

### Leg 1 — Stop 1 → Stop 2 (07:50 → 08:13)
- *(continue straight along Eleventh St & Benetook Ave — not a turn)*
- **08:02** Right into Flora Avenue (from Eleventh St)
- Right into Eighth Street
- Left into Riverside Avenue
- Right into Washington Drive
- Right into Sixth Street
- **08:08** Right into Mansell Drive / Ontario Avenue (from Sixth St)
- Left into Eighth Street
- Right into Walnut Avenue
- Left into Twelfth Street
- **08:13** Arrive St Joseph's College

### Leg 2 — Stop 2 → Stop 3 (08:13 → 08:18)
- Right into Langtree Parade
- Right into Thirteenth Street
- Left into Walnut Avenue
- Left into Fourteenth Street
- Left into Havilah Crescent
- **08:18** Arrive Mildura Senior College / Chaffey Secondary

### Leg 3 — Stop 3 → Stop 4 (08:18 → 08:30)
- Right into Fourteenth Street
- Right into Walnut Avenue
- **08:23** Left into Eleventh Street
- Left into Ontario Avenue
- Right into Twelfth Street
- Right into Riverside Avenue
- **08:30** Arrive St Joseph's Stadium — *co-ord with D11, Koorlong students transfer here to Merbein P-10*

### Leg 4 — Stop 4 → Stop 5 (08:30 → 08:42)
- *(continue straight on Riverside Ave through the Eleventh St intersection — not a turn)*
- Left into Eighth Street
- **08:35** Left into Dyar Avenue
- Right into Eleventh Street — *pick up any passengers for Merbein P-10 & Our Lady of the Sacred Heart*
- Left into Flora Avenue / River Road / Ranfurly Way — *pick up ALL Merbein students in Flora Avenue / River Road*
- Right into Reilly Street
- Left into Commercial Street
- Left into Park Street
- **08:42** Arrive Merbein P-10 College

### Leg 5 — Stop 5 → Stop 6 (08:42 → 08:48)
*(corrected from printed sheet per Mandeep — sheet was missing Commercial St and had two directions wrong)*
- Right into Game Street
- Right into Mead Street
- **Left into Commercial Street** (Merbein — not on printed sheet)
- **Right into O'Bryan Street** (printed sheet wrongly says "left")
- **Left into Box Street** (printed sheet wrongly says "right")
- **08:48** Arrive Our Lady of the Sacred Heart — *final drop, walk through bus, declare no children left*

### Leg 6 — Dead run: Our Lady → Depot (08:48 → 09:12)
- (Run sheet doesn't break this down — straight return to Mildura Depot)

---

## Mid-route pickup zones (no scheduled time, but pickups are expected)

These aren't in the stops table but the run sheet calls them out as places the driver must look for waiting passengers:

1. **Eleventh Street, between Dyar Ave and Flora Ave** (after 08:35) — anyone heading to Merbein P-10 or Our Lady of the Sacred Heart
2. **Flora Avenue / River Road / Ranfurly Way** (during Leg 4) — *all* Merbein students

**Important:** kids can board AND alight anywhere on the route, not just at scheduled stops. There are no "drop-only" or "pickup-only" stops — different kids attend different schools and connect to different buses, so flow can go either way at any point.

---

## What's currently in the DB vs this sheet

| Element | DB has it? | Notes |
|---|---|---|
| 6 scheduled stops with times | ✅ Yes (`route_stops` rows 1–6 of route 715102-AM) | Stops + times match exactly |
| `path_geojson` LineString | ✅ Yes | Traced manually, follows the road, no validation |
| Turn-by-turn waypoints (kind='turn') | ❌ No | None of Leg 1–5 turns are in `route_stops` |
| Timed intermediate waypoints (08:02, 08:08, 08:23, 08:35) | ❌ No | Drivers can't see "are we on time at the in-between checkpoints" |
| Mid-route pickup zones | ❌ No | App treats route as scheduled-stops only |
| Coordination notes ("co-ord with D11", "Koorlong → Merbein") | ❌ No | Not surfaced anywhere |
| "No children left" declaration | ❌ No | App has no end-of-run sign-off step |
| Sign-on / sign-off / WAD2 / meal break | ❌ No | Out of scope of current data model |

---

## Turn checklist (driver-friendly)

A clean numbered list of every left/right turn for the AM service. Times in **bold** are the "am I on time?" checkpoints — if the bus is at the listed point at the listed minute, the run is on schedule.

### Pre-service: depot → first pickup
1. **07:48** — Depart Mildura Depot
2. Left into Bathurst Court
3. Left into Cowra Avenue
4. Left into Eleventh Street
5. ★ **07:50** — Stop 1: **Eleventh St / Benetook Ave** (first pickup)

### Leg 1: Stop 1 → Stop 2
6. *(no turn — continue straight along Eleventh St & Benetook Ave)*
7. **08:02** — Right into Flora Avenue (from Eleventh St)
8. Right into Eighth Street
9. Left into Riverside Avenue
10. Right into Washington Drive
11. Right into Sixth Street
12. **08:08** — Right into Mansell Drive / Ontario Avenue (from Sixth St)
13. Left into Eighth Street
14. Right into Walnut Avenue
15. Left into Twelfth Street
16. ★ **08:13** — Stop 2: **St Joseph's College**

### Leg 2: Stop 2 → Stop 3
17. Right into Langtree Parade
18. Right into Thirteenth Street
19. Left into Walnut Avenue
20. Left into Fourteenth Street
21. Left into Havilah Crescent
22. ★ **08:18** — Stop 3: **Mildura Senior College / Chaffey Secondary**

### Leg 3: Stop 3 → Stop 4
23. Right into Fourteenth Street
24. Right into Walnut Avenue
25. **08:23** — Left into Eleventh Street
26. Left into Ontario Avenue
27. Right into Twelfth Street
28. Right into Riverside Avenue
29. ★ **08:30** — Stop 4: **St Joseph's Stadium** (co-ord D11; Koorlong → Merbein P-10)

### Leg 4: Stop 4 → Stop 5
30. *(no turn — continue straight on Riverside Ave through the Eleventh St intersection)*
31. Left into Eighth Street
32. **08:35** — Left into Dyar Avenue
33. Right into Eleventh Street *(pickup zone — Merbein/Our Lady passengers)*
34. Left into Flora Avenue / River Road / Ranfurly Way *(pick up all Merbein students)*
35. Right into Reilly Street
36. Left into Commercial Street
37. Left into Park Street
38. ★ **08:42** — Stop 5: **Merbein P-10 College**

### Leg 5: Stop 5 → Stop 6
*(Corrected by Mandeep — printed run sheet has errors here)*
39. Right into Game Street
40. Right into Mead Street
41. **Left into Commercial Street** *(Merbein — missing from printed sheet)*
42. **Right into O'Bryan Street** *(printed sheet wrongly says "left")*
43. **Left into Box Street** *(printed sheet wrongly says "right")*
44. ★ **08:48** — Stop 6: **Our Lady of the Sacred Heart** (final drop, walk through, declare no children left)

---

### Timing checkpoint summary

| Time | Where you should be |
|---|---|
| 07:48 | Departing Mildura Depot |
| 07:50 | At first pickup (Eleventh St / Benetook Ave) |
| 08:02 | Turning right into Flora Avenue (from Eleventh St) |
| 08:08 | Turning right into Mansell Drive / Ontario Avenue (from Sixth St) |
| 08:13 | Arriving St Joseph's College |
| 08:18 | Arriving Mildura Senior College / Chaffey Secondary |
| 08:23 | Turning left into Eleventh Street (from Walnut Ave) |
| 08:30 | Arriving St Joseph's Stadium |
| 08:35 | Turning left into Dyar Avenue (from Eighth St) |
| 08:42 | Arriving Merbein P-10 College |
| 08:48 | Arriving Our Lady of the Sacred Heart |

---

## Counter semantics

- **The end-of-day TOTAL pickup count is what matters**, not per-stop attribution.
- Per-stop counts are a *convenience marker* — handy to tap as you pick up, but not the source of truth.
- Drivers should be able to tap the counter freely whenever someone gets on, including between scheduled stops (e.g., during the Flora/River Road pickup stretch).
- 0 pickups at a stop is a normal, expected case (request-stop semantics) — never warn the driver about it.

## Implications for Phase 9 (admin route editor)

For an editor that fully captures this sheet, the admin needs to be able to:

1. **Add `kind='turn'` rows between stops** — each turn instruction with its lat/lng (e.g., the right turn at Flora Ave + Eighth St). The data model already supports this; the editor just needs UI to add them along the drawn line.
2. **Optionally attach a `scheduled_time` to a turn** for the timed waypoints (08:02, 08:08, 08:23, 08:35) — already supported by the schema (`scheduled_time` is on `route_stops`, applies to both `stop` and `turn`).
3. **Add a new `kind` value or a flag** for mid-route "pickup zones" along a polyline (Eleventh St + Dyar→Flora; Flora/River Road). Either:
   - Extend `kind` to include `'pickup_zone'` (data-model change), OR
   - Treat them as `kind='turn'` with `instruction_text` describing the zone (no schema change)
4. **Coordination/cross-shift notes** — could live in `instruction_text` on the relevant stop, no schema change needed.
5. **End-of-shift declaration** — separate UI feature on the EndOfRun screen, not in `route_stops`.
6. **Sign-on / sign-off / WAD2 / meal break** — out of scope for the route editor; these are shift-level, not route-level.

---

## Data model summary (current `route_stops` for AM)

```
route_id = c5582b62-d474-40b6-a450-bd10945157f1   -- 715102-AM
sequence | kind | scheduled_time | stop_name
---------+------+----------------+---------------------------------------
   1     | stop |   07:50:00     | Eleventh St / Benetook Ave
   2     | stop |   08:13:00     | St Joseph's College / Twelfth Ave
   3     | stop |   08:18:00     | Mildura Senior College / 14th St
   4     | stop |   08:30:00     | St Joseph's Stadium
   5     | stop |   08:42:00     | Merbein P-10 College
   6     | stop |   08:48:00     | Our Lady of the Sacred Heart
```

Once turns are added, sequence numbers will need rewriting so turns interleave between stops at their correct geographic order.
