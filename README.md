# WING

Indoor wayfinding for University of Bath campus buildings. Scan a QR code to
set your location, pick a destination, get a route — no live tracking.

**One repo, two top-level folders:**

```
app/
  frontend/   ← the React app — everything in Running it locally below
  backend/    ← Supabase project config (schema, seed data, future Edge Functions)
```

This is still one repo, not two. "Backend" here doesn't mean a custom server
you build and deploy — it means Supabase's configuration: SQL migrations and
(later) Edge Functions, applied to a managed Supabase project via its CLI.
There's no separate server process with its own release cycle, which is the
usual reason to split into two repos — see `frontend/README.md` for the full
reasoning if you want it. Keeping them as two folders in one repo means a
schema change and the frontend code that depends on it ship together in one
PR, while still being easy to tell apart at a glance.

## Running it locally

```bash
cd frontend
npm install
cp .env.example .env   # fill in your Supabase project URL + anon key
npm run dev
```

## Setting up the backend

Apply the schema to your Supabase project with the Supabase CLI from inside
`backend/` (it looks for the `supabase/` folder relative to where you run
it), or just paste `backend/supabase/migrations/0001_init.sql` then
`backend/supabase/seed.sql` into the Supabase SQL editor.

## Where things live

- **`frontend/`** — the React app. See `frontend/README.md` for the layer
  structure (types/repositories/utils/services/hooks/screens) and the import
  rule that keeps it organised.
- **`backend/supabase/migrations/`** — the database schema.
- **`backend/supabase/seed.sql`** — a small worked example (Room 1.01 →
  two junctions → Room 1.08 + a lift) used by `frontend/tests/dijkstra.test.ts`.
- **`backend/supabase/functions/`** — empty, reserved for Edge Functions, if
  we ever need logic that can't run in the browser. Nothing needs this yet.

## Adding a new floor's data

1. Add a row to `buildings` (if it's a new building) and `floors`.
2. Add one row per room/junction/stairs/lift/exit to `nodes`, with local
   `x, y` coordinates in metres (used for routing distance) and `lng, lat`
   (used for map rendering).
3. Add one row per corridor connection to `edges`, with `weight` set to the
   distance in metres.
4. Print and place QR codes, then add one row per code to `qr_codes`
   mapping the physical sticker's string to its `node_id`.
5. Nothing in `frontend/src/` needs to change — the app reads buildings
   generically.
