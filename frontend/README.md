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
| `services/` | `types/`, `utils/`, `repositories/` | React |
| `hooks/` | `types/`, `services/`, `repositories/`, React | `supabase-js` directly |
| `components/`, `screens/` | `hooks/`, `types/` | `supabase-js`, `utils/` directly |

**The single rule to enforce in review:** no `.tsx` file ever calls
`supabase.from(...)` directly. If you see that, the code belongs in
`repositories/` instead.

### What's in each folder

- **`types/`** — the shape of our data (`Node`, `Edge`, `Building`, `Route`).
  Read this file first — it's the vocabulary for every conversation about
  WING.
- **`repositories/`** — the *only* files that talk to Supabase.
  `graphRepository.fetchGraph()`, `qrRepository.resolveCode()`.
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

```bash
npm install
cp .env.example .env   # fill in your Supabase project URL + anon key
npm run dev
```

## Testing

```bash
npm test
```

`tests/dijkstra.test.ts` is a good first test to read if you're new to
testing — it's a pure function with no mocking required.
