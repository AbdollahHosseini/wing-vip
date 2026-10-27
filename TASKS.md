# WING — Task List

What to actually do, in order. See `README.md` (architecture + why one repo)
and `frontend/README.md` (the layer rules) for the reasoning behind any of
this — this file is just the checklist.

---

## Phase 0 — Fix what's already scaffolded, before adding anything new

The architecture is solid, but it hasn't actually been run yet. Do these
first — they're cheap and some are real gaps, not polish.

- [ ] `git init`, add a `.gitignore` (`node_modules`, `.env`, `dist`)
- [ ] Add `index.html` + `vite.config.ts` to `frontend/` — `npm run dev`
      currently doesn't work without these
- [ ] Create a real Supabase project; apply
      `backend/supabase/migrations/0001_init.sql` then `seed.sql`
- [ ] **Write and apply Row Level Security (RLS) policies.** Right now the
      anon key (public, visible in the browser bundle) can read AND write
      AND delete every table. Minimum: anon gets read-only `SELECT` on
      `buildings`/`floors`/`nodes`/`edges`/`qr_codes`; only an authenticated
      admin role can write. Do this before anyone outside the team touches
      the live site.
- [ ] Add an ESLint rule enforcing the import boundary (no `supabase-js`
      import outside `repositories/`) — right now it's only a README
      promise, checked by hand
- [ ] Set up CI (GitHub Actions): run `npm test` + `tsc --noEmit` + lint on
      every PR

## Phase 1 — First real building, indoor-only

Prove the whole pipeline end to end on one small building before scaling.

- [ ] Pick the smallest/simplest building to prototype with first
- [ ] Request floor plans from Estates for that building; fall back to
      manual measurement (laser rangefinder) if they don't arrive in time
- [ ] Digitise into GeoJSON (QGIS or geojson.io), tagging `level`, `height`,
      and node/edge routing properties
- [ ] Replace `seed.sql`'s placeholder data with the real digitised building
- [ ] **Wire the `accessible` flag through the algorithm.** It's modelled
      in the schema and the `Edge` type already, but `findShortestPath`
      doesn't read it yet — filter to accessible-only edges when the user
      asks to avoid stairs. Small task, just not done.
- [ ] Pick the 2D map rendering library — **Leaflet** recommended (lightest,
      no WebGL requirement, best mobile performance; see earlier research).
      Build floor-switching by hand (no indoor-specific plugin needed).
      Optional: a separate, lazily-loaded Three.js view for a building
      overview screen, kept out of the main scan→route flow.
- [ ] Build the `RouteMap` component — render `route.path` as a line over
      the floor plan
- [ ] Print and place QR codes for that building; populate `qr_codes` with
      the real codes
- [ ] On-device test: scan a real code, search a destination, confirm the
      route renders correctly end to end

## Phase 2 — Cross-building (outdoor) routing

- [ ] Sign up for an OpenRouteService API key (free tier)
- [ ] Extend `RoutingService` to orchestrate: indoor Leg 1 → ORS outdoor
      leg → indoor Leg 2, returned as one unified `Route` the UI renders as
      a single journey
- [ ] **Tag every exit/entrance node with its correct real floor level.**
      Critical for Bath's hillside campus — the same building can have
      entrances on different floors depending on which side you approach
      from. Get this wrong and the final indoor leg assumes the wrong
      starting floor.
- [ ] Ship "nearest exit" as the MVP exit-selection logic; note that
      jointly optimising exit + outdoor leg + entrance is the correct
      long-term answer, not required now
- [ ] **Audit OpenStreetMap data for Bath's campus.** Check known shortcuts
      are mapped as footpaths; check accessibility tags (kerb, incline,
      surface) exist on key paths. Fix gaps via the public OSM editor —
      this benefits everyone on OSM-based maps, not just WING, and is free.
- [ ] Test one real two-building route end to end

## Phase 3 — Making this safe to actually show people

- [ ] Confirm RLS actually blocks anon writes (test it, don't assume it)
- [ ] Add offline caching: `vite-plugin-pwa` + IndexedDB persistence of the
      fetched graph. The whole campus graph is small (a few thousand
      nodes/edges, likely well under a few MB) — full offline caching is
      realistic, not a stretch goal.
- [ ] Add `manifest.json` + icons (PWA "Add to Home Screen")
- [ ] Visual design pass — the current screens are fully unstyled
      placeholders. Separate task, needs its own design direction decided
      before building.

## Phase 4 — Scaling across campus

- [ ] Repeat Phase 1's digitisation pipeline building by building. This is
      expected to span multiple VIP cohorts/years — that's normal, not a
      sign the plan is broken.
- [ ] Watch Supabase's free-tier limits (weekly pause on inactivity, 500MB
      storage); upgrade to Pro ($25/month) when they start to bind —
      cheap, zero code changes required
- [ ] Instrument which QR codes actually get scanned, to answer the
      "optimal checkpoint density" research question with real data instead
      of guesswork

---

## Explicitly not doing right now (and why, so this doesn't get re-litigated every year)

- **BLE beacons** — real hardware/install/maintenance cost, and **Web
  Bluetooth has zero support in iOS Safari** with no sign Apple will ship
  it — would silently fail for every iPhone user of a web app.
- **WiFi RTT (802.11mc)** — same iOS gap as BLE, plus needs specific router
  hardware most of campus doesn't have.
- **UWB** — no public browser API exists for this at all; would require
  going native.
- **Dead reckoning** (step-counting + heading between QR scans) — real
  multi-week engineering effort (indoor magnetic interference is a known
  hard problem), with limited payoff at Bath's building scale. Reconsider
  only if real usage data shows people are genuinely getting lost between
  checkpoints.
- **Wagner-style furniture-level 3D detail** — that's a different product
  (a visual showcase, typically vendor-built with a custom in-house
  editor) solving a different problem than wayfinding. Simple wall
  extrusion is the right scope if 3D is used at all.

## Quick reference

- Architecture and layer rules: `README.md`, `frontend/README.md`
- Stack: React (`frontend/`), Supabase (`backend/`), Leaflet for 2D maps,
  OpenRouteService for outdoor routing, `qr-scanner` for QR codes, Dijkstra
  client-side for indoor routing
