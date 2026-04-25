# Shift 715102 AM — Coordinates per turn

**Status:** in progress — Mandeep sending coords one by one. Don't write to DB until every row is filled.

**Source:** Mandeep, picked from satellite imagery (verified against the polyline he originally drew).

**Convention:** Coords are in `(lat, lng)` order (decimal degrees, WGS84). All in Mildura VIC, Australia.

---

## Anchors (already known)

| # | Description | Lat | Lng | Source |
|---|---|---|---|---|
| — | Depot (CDC Mildura) | -34.207321 | 142.174426 | Google Maps link |
| ★1 | Stop 1: Eleventh St / Benetook Ave | -34.201443 | 142.171439 | Google Maps link |

---

## Turns (in driving order)

Each row is one entry from the AM turn checklist. `kind = 'turn'` unless marked ★ (stop). Times shown only for the 4 timed checkpoints + 6 stops.

| Seq | Time | Action | Lat | Lng | Notes |
|---|---|---|---|---|---|
| 1 | 07:48 | Depart Mildura Depot | -34.207321 | 142.174426 | (anchor) |
| 2 | | Left into Bathurst Court | -34.20731436 | 142.17415835 | ✓ Mandeep |
| 3 | | Left into Cowra Avenue | -34.20769280 | 142.17489388 | ✓ Mandeep |
| 4 | | Left into Eleventh Street | -34.20583961 | 142.17688120 | ✓ Mandeep |
| ★5 | 07:50 | **Stop 1: Eleventh St / Benetook Ave** | -34.201443 | 142.171439 | (anchor) |
| 6 | 08:02 | Right into Flora Avenue (from Eleventh St) | -34.16888741 | 142.13270760 | ✓ Mandeep |
| 7 | | Right into Eighth Street | -34.16470419 | 142.13823797 | ✓ Mandeep |
| 8 | | Left into Riverside Avenue | -34.17273535 | 142.14780571 | ✓ Mandeep |
| 9 | | Right into Washington Drive | -34.17166704 | 142.14928877 | ✓ Mandeep |
| 10 | | Right into Sixth Street | -34.17097474 | 142.15285530 | ✓ Mandeep |
| 11 | 08:08 | Right into Mansell Drive / Ontario Ave | -34.17375162 | 142.15607999 | ✓ Mandeep |
| 12 | | Left into Eighth Street | -34.17693594 | 142.15285528 | ✓ Mandeep |
| 13 | | Right into Walnut Avenue | -34.18098153 | 142.15746609 | ✓ Mandeep |
| 14 | | Left into Twelfth Street | -34.18691352 | 142.15074756 | ✓ Mandeep |
| ★15 | 08:13 | **Stop 2: St Joseph's College** | -34.18804513 | 142.15215751 | ✓ Mandeep |
| 16 | | Right into Langtree Parade | -34.18983831 | 142.15404329 | ✓ Mandeep |
| 17 | | Right into Thirteenth Street | -34.19118358 | 142.15226046 | ✓ Mandeep |
| 18 | | Left into Walnut Avenue | -34.18831578 | 142.14862108 | ✓ Mandeep |
| 19 | | Left into Fourteenth Street | -34.19398622 | 142.14191356 | ✓ Mandeep |
| 20 | | Left into Havilah Crescent | -34.19651963 | 142.14525474 | ✓ Mandeep |
| ★21 | 08:18 | **Stop 3: Mildura Senior College / Chaffey** | -34.19698053 | 142.14626337 | ✓ Mandeep |
| 22 | | Right into Fourteenth Street | -34.19725465 | 142.14578353 | ✓ Mandeep |
| 23 | | Right into Walnut Avenue | -34.19380866 | 142.14191721 | ✓ Mandeep |
| 24 | 08:23 | Left into Eleventh Street | -34.18523066 | 142.15216492 | ✓ Mandeep |
| 25 | | Left into Ontario Avenue | -34.18134505 | 142.14723793 | ✓ Mandeep |
| 26 | | Right into Twelfth Street | -34.18260573 | 142.14547995 | ✓ Mandeep |
| 27 | | Right into Riverside Avenue | -34.17846450 | 142.14084560 | ✓ Mandeep |
| ★28 | 08:30 | **Stop 4: St Joseph's Stadium** | -34.17778705 | 142.14160461 | ✓ Mandeep · co-ord D11 |
| 29 | | Left into Eighth Street | -34.17278571 | 142.14757313 | ✓ Mandeep · (after crossing 11th St straight) |
| 30 | 08:35 | Left into Dyar Avenue | -34.16881434 | 142.14269520 | ✓ Mandeep |
| 31 | | Right into Eleventh Street | -34.17298646 | 142.13743547 | ✓ Mandeep · pickup zone starts |
| 32 | | Left into Flora Ave / River Rd / Ranfurly Way | -34.16907729 | 142.13254156 | ✓ Mandeep · pickup zone continues |
| 33 | | Right into Reilly Street | -34.17408309 | 142.07962063 | ✓ Mandeep |
| 34 | | Left into Commercial Street | -34.16871062 | 142.07300134 | ✓ Mandeep |
| 35 | | Left into Park Street | -34.16922632 | 142.06976590 | ✓ Mandeep |
| ★36 | 08:42 | **Stop 5: Merbein P-10 College** | -34.16999711 | 142.06980155 | ✓ Mandeep |
| 37 | | Right into Game Street | -34.17050679 | 142.06956538 | ✓ Mandeep |
| 38 | | Right into Mead Street | -34.17007272 | 142.06805650 | ✓ Mandeep |
| 39 | | Left into Commercial Street (Merbein) | -34.16814133 | 142.06806086 | ✓ Mandeep · **NOT on printed run sheet** |
| 40 | | Right into O'Bryan Street | -34.16780724 | 142.06310739 | ✓ Mandeep · run sheet wrongly says "left" |
| 41 | | Left into Box Street | -34.16652709 | 142.06299716 | ✓ Mandeep · run sheet wrongly says "right" |
| ★42 | 08:48 | **Stop 6: Our Lady of the Sacred Heart** | -34.16651601 | 142.05374527 | ✓ Mandeep · final drop |

---

## Notes / open items

- All 41 entries received and labeled (entries 1–42; entry numbering skips 5 — see anchors). 6 stops + 35 turns.
- **Run sheet errors confirmed by Mandeep for the Merbein → Our Lady leg:**
  - Run sheet missing: Left into Commercial Street (Merbein) — between Mead St and O'Bryan St
  - Run sheet wrong direction: O'Bryan St is a RIGHT turn (sheet says left)
  - Run sheet wrong direction: Box St is a LEFT turn (sheet says right)
- Note: "Commercial Street" appears twice in the AM route — once in Mildura (turn 34) and once in Merbein (turn 39). Same name, different streets.
- Verify Stop 2–6 coords vs DB before any update
- Two non-turn instructions in the run sheet are deliberately excluded:
  - "Continue along Eleventh St & Benetook Ave" (between Stop 1 and turn 6)
  - "Cross Eleventh St straight on Riverside Ave" (between Stop 4 and turn 29)
