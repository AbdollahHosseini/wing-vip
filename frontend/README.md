# WING — frontend

The React app. See the top-level `../README.md` for the backend and why this
whole project is one repo split into `frontend/` and `backend/` folders.

## The one rule that explains this folder's structure

**A file's layer is defined by what it's allowed to import.**

| Layer | May import | Must NOT import |
|---|---|---|
| `types/` | nothing | anything |
| `utils/` | `types/` | React, `supabase-js` |
| `repositories/` | `types/`, `@supabase/supabase-js` | React |
| `services/` | `types/`, `utils/`, `repositories/` | React, `supabase-js` |
| `hooks/` | `types/`, `services/`, `repositories/`, React | `supabase-js` directly |
| `components/`, `screens/` | `hooks/`, `types/`, `components/` | `supabase-js`, `utils/` directly |

npm packages: `types/` and `utils/` import none; every other layer may use
any npm package except the ones in its Must NOT column (React in
`repositories/` and `services/`; `@supabase/*` everywhere except
`repositories/`).

**The single rule to enforce in review:** no `.tsx` file ever calls
`supabase.from(...)` directly. If you see that, the code belongs in
`repositories/` instead.

`npm run lint` checks this table for you: an import that breaks it, such as a
screen importing `../utils/dijkstra` or `@supabase/supabase-js`, is an error
whose message names the rule. Files may also import others in their own
folder, and `App.tsx` and `main.tsx` count as UI (screens, components, hooks
and types only).

### What's in each folder

- **`types/`** — the shape of our data (`Node`, `Edge`, `Building`, `Route`).
  Read this file first — it's the vocabulary for every conversation about
  WING.
- **`repositories/`** — the *only* files that talk to Supabase.
  `graphRepository.fetchBuildingData()`,
  `closureRepository.fetchActiveClosures()`, `qrRepository.resolveCode()`.
- **`utils/`** — pure algorithms. No React, no database, no side effects:
  input in, answer out. `dijkstra.ts`, `directions.ts`.
- **`services/`** — orchestration: combines repositories + utils into one
  named operation. `RoutingService.calculateRoute()` = fetch the graph →
  run Dijkstra → generate directions.
- **`hooks/`** — the "controller" of this app. In a classic backend, a
  controller receives a request and decides what to do; here the "request"
  is a UI event (QR scanned, destination picked), and a hook plays that
  role. `useRoute()`, `useQrScanner()`.
- **`components/`, `screens/`** — purely presentational. Render whatever a
  hook hands them.

## Why one repo, not a separate frontend/backend repo

A frontend/backend split earns its keep when the backend is an independently
*deployed process* — its own build, its own release cycle, possibly multiple
consumers. None of that applies to a Supabase backend: there's no server
binary this team builds or deploys, only SQL migrations and config applied
to a managed project. There's exactly one consumer of the data (this app).
A schema change and the repository code that depends on it are one logical
change — splitting repos would force that into two coordinated PRs across
two clones, which is real coordination overhead for a team with first-years
rotating in and out every year, with no corresponding benefit.

## Running it

Node 26 LTS (the version in `../.nvmrc`); Node 24, or Node 22.12 or a later
22.x, also works (not 23 or 25, which Vitest does not support). npm may say a
new major version of npm is available: ignore it and keep the npm that came
with your Node (npm 12 needs Node 22.22.2 or 24.15 or newer).
From inside `frontend/`:

```bash
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

## Testing

```bash
npm test             # run every test once
npm run test:watch   # re-run as you save
```

`tests/dijkstra.test.ts` is a good first test to read if you're new to
testing — it's a pure function with no mocking required.

## Linting, type-checking and building

```bash
npm run lint         # Oxlint, settings in .oxlintrc.json
npm run typecheck    # TypeScript 7 (tsc -b) over src/ and tests/
npm run build        # type-check, then build the site into dist/
```

`npm run lint` fails on correctness and likely-bug problems, on React hooks
mistakes and on every jsx-a11y accessibility rule, so an image without alt
text or a label not tied to its control fails the check. It also enforces the
folder rule above. Warnings fail too, so only "0 warnings and 0 errors"
passes: fix the code, or for a deliberate exception add
`// oxlint-disable-next-line <rule>` with a comment giving the reason.
A disable comment that no longer hides anything is an error too, so stale
ones get cleaned up.

Lint can't check everything about accessibility: colour contrast, focus
order and how a screen actually sounds in a screen reader still need a
manual check.

CI runs all three plus `npm test` and a Wrangler dry run on every pull
request — see "Before you open a pull request", "CI" and "Hosting" in
`../README.md`.
