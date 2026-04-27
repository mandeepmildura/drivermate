# Shift 715102 PM — Coordinates per turn

**Status:** Complete (24/24 waypoints).

**Source:** Mandeep, picked from satellite imagery (verified live on a PM run on 2026-04-27).

**Convention:** Coords are in `(lat, lng)` order (decimal degrees, WGS84). All in Mildura / Merbein VIC, Australia.

---

## Anchors (already known)

| # | Description | Lat | Lng | Source |
|---|---|---|---|---|
| — | Depot (CDC Mildura) | -34.207321 | 142.174426 | (anchor) |
| ★1 | Stop 1: Our Lady of the Sacred Heart | -34.16651601 | 142.05374527 | AM ★42 |
| ★2 | Stop 2: Merbein P-10 College | -34.16999711 | 142.06980155 | AM ★36 |
| ★3 | Stop 3: St Joseph's College Stadium | -34.17778705 | 142.14160461 | AM ★28 |

---

## Turns and stops (in driving order)

`kind = 'turn'` unless marked ★ (stop). Times shown only for the timed checkpoints + 4 stops. **Bold** rows are corrections to the printed sheet (printed sheet wrong direction or missing entirely).

| Seq | Time | Action | Lat | Lng | Notes |
|---|---|---|---|---|---|
| 1 | 15:30 | Depart Our Lady of the Sacred Heart | -34.16651601 | 142.05374527 | (anchor; OSRM snapped to "Box Street" 2.2 m off — school entrance) |
| 2 | | Left into Surgey Street | -34.16658833186546 | 142.05263528193234 | OSRM-confirmed street name (0.37 m snap). Not a printer typo. |
| 3 | | Left into Commercial Street (Merbein) | -34.16811571550845 | 142.05264128845707 | |
| 4 | 15:33 | Right into Park Street | -34.16922632 | 142.06976590 | shared with AM seq 35 |
| ★5 | 15:38 | **Stop 2: Merbein P-10 College** | -34.16999711 | 142.06980155 | shared with AM ★36. instruction_text has co-ord note: Shift 5 / D27, direct Flora & Eighth Street kids to 733 (MR5) |
| 6 | | Right into Game Street | -34.17050679 | 142.06956538 | shared with AM seq 37 |
| 7 | | Right into Mead Street | -34.17007272 | 142.06805650 | shared with AM seq 38 |
| 8 | | Right into Commercial Road | -34.168195696659986 | 142.06812478766187 | turn waypoint only — *not* on the OSRM line (caused a school-grounds backtrack); auto-advance still fires when bus crosses it |
| 9 | | Reilly Street | -34.17408309 | 142.07962063 | direction not printed; OSRM-snapped to "Ranfurly Way" (0.48 m); shared with AM seq 33 |
| 10 | | Ranfurly Way / Flora Avenue | -34.16907729 | 142.13254156 | road-name change, not an actual turn; shared with AM seq 32 |
| 11 | | **Right into Eleventh Street** | -34.1689364770262 | 142.13273259403536 | ✓ Mandeep · **missing from printed sheet** |
| 12 | | **Left into Dyar Avenue** | -34.17296286981528 | 142.13767584045507 | ✓ Mandeep · run sheet wrongly says "right". At Eleventh/Dyar corner (south end of Dyar) |
| 13 | | **Right into Eighth Street** | -34.168769866567565 | 142.14280499324704 | ✓ Mandeep · run sheet wrongly says "left". Dyar/Eighth corner |
| 14 | | Right into Riverside Avenue | -34.17273535 | 142.14780571 | shared with AM seq 8 (Eighth/Riverside corner) |
| ★15 | 15:55 | **Stop 3: St Joseph's College Stadium** | -34.17778705 | 142.14160461 | shared with AM ★28 |
| 16 | | Left into Twelfth Street | -34.17855861575502 | 142.14083845203623 | |
| 17 | | Left into Ontario Avenue | -34.182646460630274 | 142.14564894137015 | |
| 18 | | **Right into Eleventh Street** | -34.181215282595744 | 142.1473672664859 | ✓ Mandeep · **missing from printed sheet** |
| 19 | | **Right into Walnut Avenue** | -34.1853026497314 | 142.1523050954175 | ✓ Mandeep · run sheet wrongly says "left" |
| 20 | | Left into 14th Street | -34.19398622 | 142.14191356 | shared with AM seq 19 |
| ★21 | 16:10 | **Stop 4: Deakin St & Eleventh St** (final drop) | -34.19747232586179 | 142.14628703025815 | walk-through declaration |
| 22 | | Left into Deakin Avenue | -34.197939783945536 | 142.14678434211484 | turn happens immediately after the drop |
| 23 | | Right into 11th Street | -34.189609824381506 | 142.15756919308436 | bus drives east on 11th past Deakin before next turn |
| 24 | | End of service | -34.20275188842392 | 142.17331340084164 | last auto-advance waypoint; bus dead-runs to depot from here |

---

## Notes / open items

- **Run sheet errors confirmed by Mandeep on 2026-04-27 PM test run:**
  - Leg 2 missing turn: Right into Eleventh Street (between Ranfurly/Flora and Dyar)
  - Leg 2 wrong direction: Dyar Avenue is a LEFT turn (sheet says right)
  - Leg 2 wrong direction: Eighth Street is a RIGHT turn (sheet says left)
  - Leg 3 missing turn: Right into Eleventh Street (between Ontario and Walnut)
  - Leg 3 wrong direction: Walnut Avenue is a RIGHT turn (sheet says left)
- **2.4 Commercial Road is intentionally off the OSRM road polyline** but kept as a turn waypoint. With it included, OSRM produced a 1.5 km westward detour through Merbein P-10 grounds because the coord placement (at the Mead/Commercial corner) made the shortest-path route loop back. The auto-advance trigger still fires on the coord regardless of whether it's on the visual line — `route_stops` rows drive nav logic; `path_geojson` is purely cosmetic.
- "Eleventh Street" appears at three different points in the PM run (turns 11, 18, and final drop area at turn 21). Same name, different segments.
- Two non-turn instructions in the run sheet are deliberately included as `turn` rows so the auto-advance has a waypoint to land on:
  - Reilly Street (seq 9) — direction not printed
  - Ranfurly Way / Flora Avenue (seq 10) — road-name change, not an actual turn
- Leg 0 (depot → Our Lady dead run, 25 min) is **not** captured in `route_stops`. Add later if drivers want turn-by-turn for the dead run.
