# Tomorrow morning — first real-route test

## The URL on your iPhone

**`https://cdcmildura.pages.dev`**

Permanent — hosted on Cloudflare Pages. Laptop can be off, internet can drop at your end, the app URL stays up. (PWA also caches for offline use after first load.)

## Tonight (before bed)

- [ ] On your iPhone, open Safari, load `https://cdcmildura.pages.dev`, log in once with `105` / `6465`. This pre-warms the PWA cache.
- [ ] Tap Safari's share button → **Add to Home Screen**. The app icon now lives on your home screen and opens full-screen, no browser chrome.
- [ ] Open the app from the home-screen icon. **Allow location** when asked. **Tap "Tap once to enable spoken instructions"**. Sign out (top right of the route picker) so tomorrow you log in fresh.

## In the morning (sign-on 0738)

- [ ] iPhone unlocked, mobile data on, low-power mode **off** (it kills GPS).
- [ ] Open DriverMate from the home-screen icon.
- [ ] Sign in: `105` / `6465`.
- [ ] Pick **715102-AM** → pick your bus (M42–M45 are placeholders, or type your real bus code in "Other bus code") → **Start shift**.
- [ ] Tap **Tap once to enable spoken instructions**. Tap **Allow While Using App** if location prompts again.

## During the AM run

- The "Next instruction" panel shows the directions for the current stop. The status bar turns green when on time, amber when slightly late, red when >5 min late.
- The **header GPS badge** shows live distance to the next stop. Within 200 m → blue "Approaching" banner. Within 50 m → green "Arrived. Auto-logging in 8s — keep counting." banner.
- Use **+ / -** buttons to count children boarding. The count auto-logs when GPS confirms arrival, OR when you tap **Stop reached**.
- "Navigate to this stop" button hands off to the Google Maps app for the moving-person view.

## Mid-shift (meal break 1130–1230)

- [ ] At Our Lady of the Sacred Heart (~0848), tap **End run** → you'll see totals + sync status. Should say "All shift data synced".
- [ ] Take your meal break. The app can stay closed.

## PM run (1505 dead-run, position 1525, depart 1530)

- [ ] Open DriverMate again. Sign in if it timed out.
- [ ] Pick **715102-PM** → pick the same bus → **Start shift**.
- [ ] Same flow as morning. Final drop is Deakin St & Eleventh St at 1610.
- [ ] **End run** → check sync status → done.

## What to watch for / report back

| Symptom | Probable cause | What to do |
|---|---|---|
| GPS badge stuck on "GPS waiting…" | iPhone hasn't acquired a fix yet | Step outside or near a window for 10 s |
| GPS badge says "GPS denied" | You declined the prompt | Settings → Privacy & Security → Location Services → Safari Websites → Allow, then reload |
| App auto-advances to next stop too early or too late | Geocoded lat/lng is off | Note which stop, fix later via `/admin → route → stop → lat/lng` |
| App shows "Offline" all morning | iPhone has no mobile data signal | Tap "Stop reached" manually all morning — data still queues locally in Dexie and syncs when reconnected |
| Audio doesn't play | Tap **Audio on / Muted** toggle in header; iPhone silent switch off | Phone hardware switch (above the volume buttons) must be in the up position |
| Counter resets unexpectedly | This is a tab refresh — the live shift stays in Dexie but the in-flight count for the current stop is React state | Use **Stop reached** to lock in counts before navigating away |

## Known approximate stops (worth fine-tuning)

These geocoded to mid-street rather than the exact intersection — auto-advance may fire ~100–200 m off:

- **Eleventh St / Benetook Ave** (AM stop 1) — pinned mid-Benetook Avenue
- **Deakin St & Eleventh St** (PM stop 4) — pinned mid-Deakin Avenue

If they auto-advance at the wrong moment, after the run open `/admin → 715102-AM → stop → Latitude/Longitude` and replace with the exact coords (right-click in Google Maps → "What's here?").

## After the run — debrief

Open this conversation again and tell me:
1. Did GPS auto-advance fire reliably for each stop?
2. Did the tunnel stay up all morning?
3. Did the sync queue drain by end of day?
4. What's the one thing that got in the way the most?

That's the input for the next round of fixes.
