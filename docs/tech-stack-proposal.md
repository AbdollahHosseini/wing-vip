# WING technical proposal

WING is meant to become the University of Bath's wayfinding website: accessible,
step-free directions to any room in any public building, across the whole
campus. It's a website (no app store), with route finding done on the phone and
Supabase as the database.

Positioning (how the site finds where the user is) is owned by the positioning
lead and not covered here.

## Tech stack

| Part | Choice | Changed? | Why |
|---|---|---|---|
| Website | React 19 + TypeScript 7, built with Vite 8 | Upgraded | Repo pins older versions; upgrading is cheapest now, before much code exists. |
| Database and API | Supabase (Postgres) with Row Level Security. No server of our own | Kept, plus security rules | No server to run. Without Row Level Security, anyone could edit the data. |
| Database plan | Supabase Pro, plus a free staging project in a separate free organisation | **New** | The free plan has no backups and only 5 GB of bandwidth a month (Pro: daily backups, 250 GB). A second project inside the Pro organisation would add about $10 a month. |
| Staff logins | Supabase Auth with university Microsoft accounts | **New** | Staff can mark a lift as broken without new passwords or the SQL editor. |
| Route finding | Dijkstra in the browser, with a priority queue, costs in seconds, three route types | Extended | Instant and works offline. Seconds let lifts and stairs compare fairly. The priority queue keeps it fast at campus scale. |
| Indoor data | University floor plans traced in QGIS, loaded by a script | Kept, plus a script | Loads every building the same way. |
| Outdoor data | OpenStreetMap, imported into our own route network | **Replaces OpenRouteService** | One set of step-free rules indoors and out, no visible API key, no daily limits. |
| Map | Leaflet, with floors switched by our own code | Kept | Simple, stable, keyboard-friendly. No indoor plugin needed. |
| Background map | Our own campus layers (building outlines, paths, green spaces) from the OpenStreetMap download, drawn by Leaflet | **New** | No extra library, no API key or limits, our own high-contrast colours, works offline, and the map shows exactly the paths we route on. (protomaps-leaflet went into maintenance mode in 2026, so we don't use it.) |
| Search | MiniSearch, in the browser | **New** | Finds rooms despite typos and other names; works offline. |
| Offline use | vite-plugin-pwa + idb-keyval | Kept | Signal is patchy inside buildings. |
| Error monitoring | Sentry | **New** | We find out when it breaks before users report it. The free plan allows one user; the Team plan is $26 a month. |
| Tests and checks | Vitest, Testing Library, Playwright + axe, PGlite, Oxlint and TypeScript, run by GitHub Actions | Extended | Every pull request is checked automatically, including accessibility and the database. Oxlint replaces ESLint (see Libraries). |
| Hosting | Cloudflare Workers (static files), or university hosting if IT offers it | **New** | Free, no credit card, no traffic limit. Cloudflare now recommends Workers instead of Pages for new projects. University hosting is better for an official service. |
| Repo | One repo (`frontend/`, `backend/`) with CODEOWNERS | Kept, plus review rules | A database change ships with the code that uses it; each lead reviews their own part. |

## Libraries

| Library | What it does | Changed? | Why |
|---|---|---|---|
| React | Builds the screens | Upgrade 18 → 19 | Stay current while it's cheap. |
| TypeScript | Catches data mistakes while typing | Upgrade to 7 | The current version. Works with Oxlint (ESLint's TypeScript plugin only supports up to 6.0). |
| Vite | Builds the site's files, fast preview while developing | Upgrade 5 → 8 | Stay current. |
| React Router 8 | Gives each screen a web address | **Added** | Back, refresh and links work. Today back leaves the site. |
| supabase-js | The site's connection to the database | Kept | |
| Supabase CLI | Applies database changes automatically | **Added** | No more pasting SQL by hand. |
| Leaflet 1.9 | Draws the interactive map, including the campus background | Kept | 2.0 is still in alpha. |
| map-gl-indoor | Indoor floors plugin | **Removed** | Unmaintained since 2022 and needs a different map library. |
| Three.js | 3D graphics | **Dropped for now** | Doesn't help find a route; screen readers can't use it. |
| OpenRouteService | Outside routing service | **Replaced on campus** | See Outdoor data above. |
| MiniSearch | Search as you type | **Added** | Hundreds of rooms need good search. |
| vite-plugin-pwa | Saves the site on the phone for offline use | Kept | |
| idb-keyval | Saves our campus data on the phone | **Added** | The repo named the storage, not a library; this makes it simple. |
| Sentry | Reports errors from users' phones | **Added** | Needed for a live service. The free plan allows one user. |
| Vitest | Small automatic code tests | Upgrade 2 → 5 | |
| Testing Library | Tests screens the way users find things | **Added** | The repo didn't test screens. |
| Playwright | Clicks through the real site in a browser | **Added** | Checks everything works together. |
| axe-core | Scans pages for accessibility problems | **Added** | Accessibility tested on every change. |
| PGlite | A test database with no setup | **Added** | CI checks every database change. |
| Oxlint | Warns about code and accessibility mistakes while typing, and enforces the folder rules | **Replaces ESLint** | ESLint's accessibility plugin (jsx-a11y) hasn't had a release since 2024 and doesn't support the current ESLint 10. Oxlint has those accessibility rules and the folder rule built in, supports TypeScript 7, and is much faster. |
| @azure/msal-browser | Microsoft sign-in in the browser | Later idea | Only for "directions to your next class". |

## Costs

| Item | Cost | Notes |
|---|---|---|
| Hosting (Cloudflare Workers) | Free | Or free on university hosting |
| Supabase production (Pro) | About $25 / month (≈ £20) | Needed for daily backups and more bandwidth |
| Supabase staging | Free | In a separate free organisation; inside the Pro organisation it would add about $10 / month |
| Sentry | Free for one user, or $26 / month for the team | The free plan allows one user; the Team plan has unlimited users |
| GitHub (organisation, Actions) | Free | |
| Background map data (OpenStreetMap) | Free | Must credit OpenStreetMap on the site |
| Web address | Free if `bath.ac.uk`, otherwise about £10–20 / year | |
| Accessibility audit | Free if done by the university's team | An external audit needs a quote |
| **Total** | **About $25 / month, or about $51 with Sentry Team** | Prices change; check before budgeting |

## Decisions needed

| Decision | Who decides | Options | Suggestion |
|---|---|---|---|
| Pilot building | Team | Any building | 4 West (already in the seed data) |
| Hosting and web address | Team and IT | Cloudflare Workers, or university hosting (likely Azure) | University hosting with a `bath.ac.uk` address if offered, otherwise Cloudflare Workers |
| Floor plan format | Team and Estates | CAD files or PDFs | CAD where available |
