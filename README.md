# WING

Indoor wayfinding for University of Bath campus buildings. Scan a QR code to
set your location, pick a destination, get a route — no live tracking.

**One repo; the code lives in two top-level folders:**

```
wing-vip/
  frontend/   ← the React app — everything in Running it locally below
  backend/    ← Supabase project config (schema, seed data, future Edge Functions)
  docs/       ← hosting setup and project proposals
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

You need **git** and **Node 26 LTS**, the version in `.nvmrc` and the one CI
uses. Node 24, or Node 22.12 or a later 22.x, also works (not 23 or 25, which
Vitest does not support). Check with `git --version`, `node --version`
(should start `v26`) and `npm --version`; if you use nvm, `nvm use` in the
repo root picks up `.nvmrc`.

npm may say a new major version of npm is available. You can ignore it. If
you're on Node 22 or 24, don't run the `npm install -g npm@...` it suggests:
npm 12 needs Node 22.22.2 or 24.15 or newer. Keep the npm that came with your
Node.

Clone into a folder that is not synced by iCloud Drive, OneDrive or Dropbox
(on a Mac, not inside Documents or Desktop when iCloud Desktop & Documents is
on): sync tools make conflict copies inside `.git` and `node_modules`.

```bash
git clone https://github.com/AbdollahHosseini/wing-vip.git
cd wing-vip/frontend
npm install
cp .env.example .env   # on Windows: copy .env.example .env
                       # then fill in your Supabase project URL + publishable key
                       # (sb_publishable_..., from Connect or Project Settings > API Keys)
npm run dev            # then open http://localhost:5173
```

Use the staging Supabase project's URL and key (ask a lead, or see the
comments in `.env.example`). Empty values give a blank page; the console
shows "supabaseUrl is required". Any placeholder, such as
`https://placeholder.supabase.co` and `placeholder`, shows the first screen,
but nothing loads from the database until you use real values.

Everything else runs from inside `frontend/` too:

| Command | What it does |
|---|---|
| `npm test` | Runs the tests once (Vitest). `npm run test:watch` re-runs them as you save |
| `npm run lint` | Oxlint: likely bugs, React hooks mistakes, accessibility problems and the folder rule in `frontend/README.md` |
| `npm run typecheck` | Type-checks `src/` and `tests/` with TypeScript 7 (`tsc -b`) |
| `npm run build` | Type-checks, then builds the site into `frontend/dist` |

## Editor setup

Open the repo root folder (not `frontend/`) in VS Code and install the
recommended extensions when it asks:

- **Oxc** shows the same lint errors as `npm run lint` while you type.
- **TypeScript 7** gives the same type errors as `npm run typecheck`.
- **EditorConfig** applies the shared formatting from `.editorconfig`
  (UTF-8, LF line endings, 2-space indent).

Other editors: JetBrains IDEs read `.editorconfig` without a plugin, and
`.gitattributes` keeps line endings LF on every computer, Windows included.

## Before you open a pull request

1. In `frontend/`: `npm test`, `npm run lint` and `npm run build` pass
   (`build` runs the type-check first). Lint only passes on "0 warnings and
   0 errors". Changed `wrangler.jsonc`? Run `npm run deploy:check` too.
2. Changed anything in `backend/osm/`? Run
   `node backend/osm/import-osm.mjs build` from the repo root and commit the
   snapshot, `outdoor-import.sql` and `entrances-to-survey.csv` together.
3. Database changes go in a new migration file — never edit one that's
   already merged.
4. No `.env` file, keys or passwords in the diff.

The pull request template has the full checklist, including the keyboard and
screen-reader check for UI changes.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every pull request and
every push to `main`. It reports two checks:

- **Frontend** — installs the frontend with `npm ci`, then runs lint,
  type-check, tests and build, and checks `wrangler.jsonc` with a Wrangler
  dry run for both environments.
- **OSM import up to date** — rebuilds the OSM import from
  `campus-snapshot.json` and checks that the committed `outdoor-import.sql`
  and `entrances-to-survey.csv` still match it.

Once branch protection on `main` requires these checks (see below), a red
check blocks merging. So before you push, run the same npm commands in
`frontend/` (and the OSM build from the repo root if you changed anything in
`backend/osm/`).

### Protecting `main`

The repository belongs to AbdollahHosseini's personal GitHub account, so only
that account can set this up, and as the owner it can merge past these rules
unless bypassing is switched off.

1. Push `ci.yml` and let it pass once on a pull request first: GitHub only
   offers a status check that has passed in this repository in the past 7
   days.
2. In **Settings** > **Branches**, add a branch protection rule for `main`
   with:
   - **Require a pull request before merging**, and **Required number of
     approvals before merging** set to 1
   - **Require review from Code Owners**
   - **Require status checks to pass before merging**, with `Frontend` and
     `OSM import up to date`
   - **Do not allow bypassing the above settings**, or the owner can still
     merge without a review
3. At go-live, add the same rule for the `live` branch.

`.github/CODEOWNERS` only asks for reviewers once its rules are uncommented
and every owner has write access to the repository.

## Hosting

The site is hosted on Cloudflare Workers as static files. Once the
Cloudflare side is connected, Workers Builds deploys every push to `main` to
the staging Worker (`wing-staging`), gives each other branch and pull request
its own Preview URL, and from launch in April deploys the live Worker
(`wing`) from a `live` branch. The setup steps, including where the Supabase
build variables go, are in [`docs/hosting.md`](docs/hosting.md), and the
Cloudflare settings are in `frontend/wrangler.jsonc`.

Day to day nobody deploys from a laptop. In `frontend/`:

- `npm run deploy:check` builds the site and checks `wrangler.jsonc` for both
  environments. It needs no Cloudflare account.
- `npm run deploy:staging` and `npm run deploy:preview` are manual fallbacks
  if Workers Builds is down. They need `npx wrangler login` first, and they
  bake **your** `.env` values into the site.
- There is deliberately no manual deploy to the live site.

## Setting up the backend

Apply the migrations, then the sample data, in this order:

1. `backend/supabase/migrations/0001_init.sql`
2. `backend/supabase/migrations/0002_accessibility_and_security.sql`
3. `backend/supabase/migrations/0003_osm_import.sql`
4. `backend/supabase/seed.sql`

Either paste them into the Supabase SQL editor in that order, or use the
Supabase CLI from inside `backend/` (it looks for the `supabase/` folder
relative to where you run it). These commands are written for CLI v3:

```bash
cd backend
npx supabase@3 login
npx supabase@3 link --project-ref <your-project-ref>
npx supabase@3 db push --remote --include-seed
```

`--remote` sends the push to the linked project: since CLI v3, a bare
`supabase db push` targets a local Docker stack instead. `--include-seed`
loads `seed.sql` after all the migrations, the same order as the list above
(and the order `supabase db reset` uses).

The app needs 0002: it switches on Row Level Security, grants the read
access the app uses, and adds the floor labels, the `nodes_geo` view and the
closures the frontend reads. 0003 adds the columns the OpenStreetMap import
uses (see `backend/osm/README.md`).

## Where things live

- **`frontend/`** — the React app. See `frontend/README.md` for the layer
  structure (types/repositories/utils/services/hooks/screens) and the import
  rule that keeps it organised.
- **`backend/supabase/migrations/`** — the database schema.
- **`backend/supabase/seed.sql`** — a small worked example (Room 1.01 →
  two junctions → Room 1.08 + a lift) used by `frontend/tests/dijkstra.test.ts`.
- **`backend/supabase/functions/`** — empty, reserved for Edge Functions, if
  we ever need logic that can't run in the browser. Nothing needs this yet.
- **`docs/`** — `hosting.md` (Cloudflare Workers setup) and the project
  proposals.

## Adding a new floor's data

1. If it's a new building, add a `buildings` row. Optionally set
   `origin_lng`, `origin_lat` and `rotation_deg`, so `nodes_geo` places its
   nodes on the map from their `x, y`. Then add a `floors` row with
   `building_id`, `level` (the number the map uses) and `label` (what the
   building's signs say, e.g. 'Level 2' or 'LG'). `label` is required.
2. Add one row per room/junction/stairs/lift/exit to `nodes`, with local
   `x, y` coordinates in metres (used for routing distance). Give each lift
   one node per floor. `lng, lat` are only needed until the building has an
   origin.
3. Add the `edges`. For each one, set `kind` (corridor/door/stairs/ramp/
   lift/outdoor) and set `accessible` to true (surveyed step-free) or false
   (has steps). Left empty, it means "not surveyed": step-free routing
   penalises it and the route screen shows a warning. Add `step_count`
   for stairs (stairs can never be `accessible = true`), and
   `door_width_m`, `automatic_door` and `slope_pct` where known.
   - `weight` (metres) can be left out for edges on the same floor: a
     trigger fills it in from `x, y`. Edges between floors and outdoor
     edges need it typed in.
   - Join the lift nodes on neighbouring floors with a `lift` edge: `weight`
     0 and `extra_seconds` for the ride plus the wait (e.g. 30).
   - Use `one_way = true` for exit-only doors or escalators.
   - Afterwards, check the `edge_length_warnings` view.
4. Print and place QR codes, then add one row per code to `qr_codes`
   mapping the physical sticker's string to its `node_id`.
5. A new floor of an existing building needs no change in `frontend/src/`.
   A new building also needs `BUILDING_ID` in `frontend/src/App.tsx`
   changed, until building selection exists.
