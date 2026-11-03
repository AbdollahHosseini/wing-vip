# WING: detailed technical proposal

A proposal for the WING leads. WING is meant to become the University of
Bath's own wayfinding website: step-free, accessible directions to any room,
in any public building, across the whole campus. This document sets out what
to build it with, what to change from the current repo, and what else a
service for the whole university needs before launch.

Library versions were checked on npm on 31 October and 1 November 2026. Much of
the database and routing work is already written and tested on the
`accessibility-routing` branch (see [Status](#status)).

Positioning (how the site works out where the user is) is not covered here:
the positioning lead owns those choices. Routing only needs a start point,
however it's found.

## What "ready for the whole university" means

WING is ready to launch when:

1. **It covers the campus.** Every public building, its floors, and the
   outdoor paths between them, with routes that cross buildings.
2. **Step-free routes can be trusted.** Every door, ramp, lift and step on
   them has been surveyed, and the site says clearly where data is missing.
3. **It meets the law.** WCAG 2.2 AA, with a published accessibility
   statement (see [Accessibility](#accessibility)).
4. **Staff can keep it current.** Estates or reception staff can mark a lift
   as broken in under a minute, without the team.
5. **It's reliable.** Separate test and live environments, backups, and
   error alerts.
6. **It outlives the team.** A university staff owner, accounts that belong
   to the university or the team, and documentation a new student can follow.

## The proposed stack

| Part | Choice | Changed from the repo? |
|---|---|---|
| Website | React 19 + TypeScript 7, built with Vite 8 | Upgrade from React 18 / Vite 5 |
| Backend | Supabase (managed Postgres): tables, Row Level Security, views. No custom server | Same, plus security rules |
| Database plan | Supabase Pro for production, with staging in a separate free organisation | **New**: the free plan isn't fit for a live service |
| Staff logins | Supabase Auth with the university's Microsoft sign-in | **New** |
| Route finding | Dijkstra in the browser with a priority queue, cost in seconds, three route types | Extended |
| Indoor data | University floor plans, traced in QGIS, loaded by a script | Same, plus an import script |
| Outdoor data | OpenStreetMap, imported into our own graph by a script | **Replaces OpenRouteService** |
| Search | MiniSearch, in the browser | **New** |
| Map display | Leaflet 1.9, floors switched by hand | Same |
| Background map | Our own campus layers from the OpenStreetMap download, drawn by Leaflet | **New** |
| Screen navigation | React Router 8 | **New** |
| Offline use | vite-plugin-pwa + idb-keyval | Same |
| Error monitoring | Sentry (free plan: one user) | **New** |
| Tests | Vitest, Testing Library, Playwright + axe-core, PGlite for the database | Extended |
| Code checks | Oxlint (accessibility rules and the folder rule built in) and TypeScript in CI | **Replaces ESLint** |
| Hosting | Suggested: Cloudflare Workers (see [Hosting](#hosting-and-environments)) | **New**: the repo doesn't say yet |
| Repo | One repo with `frontend/` and `backend/`, with CODEOWNERS | Same, plus review rules |

## Scale

What "the whole university" means in numbers, and what follows from it.

| | Estimate |
|---|---|
| Users | Around 20,000 students, plus staff, visitors and open days |
| Building entrances (from OpenStreetMap) | 142 |
| Outdoor nodes and edges | About 1,100 and 1,300 |
| Indoor nodes, all buildings | Likely 20,000 to 50,000 |
| Data size | A few MB for the whole campus |

None of this is big for the tools chosen. Static hosting serves any number of
visitors, and Postgres handles millions of rows. Three things do have to
change from the one-building demo:

1. **Route finding needs a priority queue.** `frontend/src/utils/dijkstra.ts`
   picks each next node by checking every node, and its comment assumes "a
   few hundred nodes at most". Across the whole campus that would take seconds
   on a phone. A standard priority queue (binary heap, about 40 lines, no
   library) makes it milliseconds. A* can follow if needed.
2. **Load the graph by area, not all at once.** Load the outdoor paths plus
   the start and end buildings. Cache what's loaded on the phone.
3. **No hardcoded building.** `App.tsx` fixes the building to `4W`. The site
   needs building selection and routes that cross buildings.

## The libraries the repo suggests

From `README.md`, `TASKS.md` and `frontend/package.json`.

| Library | What the repo says | Verdict | Why |
|---|---|---|---|
| React | The framework | **Keep, upgrade to 19** | The team knows it, and it fits the folder rules. 19.3 is current; the repo pins 18. Upgrade now while there's little code. |
| Vite | Build tool | **Keep, upgrade** | Fast and simple. The repo pins 5; 8.3 is current. `vite.config.ts` is still missing (TASKS Phase 0). |
| TypeScript | Language | **Keep, upgrade to 7** | Catches mistakes early, which matters with new students joining every year. 7.0 is current. ESLint's TypeScript plugin only supports up to 6.0, one reason we use Oxlint instead. |
| Vitest | Tests | **Keep, upgrade** | Works with Vite out of the box. The repo pins 2; 5.0 is current. |
| Supabase + supabase-js | The backend | **Keep, on the Pro plan** | Database, API and logins with no server to run. The free plan has no backups, only 5 GB of bandwidth a month (Pro: 250 GB), and pauses after a week without use, so a live service needs Pro (see [Costs](#costs)). |
| Dijkstra, client-side | Route finding | **Keep, extend** | Right for a campus: instant, no server, works offline. Needs a priority queue at campus scale, and costs in seconds so lifts and stairs compare fairly. |
| Leaflet | 2D map, floors switched by hand | **Keep** | Mature, light and easy for new teammates. Keyboard panning and zoom work out of the box. A floor view is just our own data filtered by level, so no indoor plugin is needed. Version 1.9.4 is stable; 2.0 is in alpha, so stay on 1.9. It also draws our campus background, so no tile library is needed. |
| map-gl-indoor | Mentioned in the schema comments | **Remove the mention** | Last updated in 2022, and it needs a different map library (MapLibre). It conflicts with the Leaflet choice. |
| Three.js | Optional 3D building overview | **Drop for now** | It doesn't help anyone find a route, screen readers can't use it, and it's a lot of work. Revisit after launch. |
| OpenRouteService | Outdoor routing | **Replace for on-campus routes** | A second routing system means two sets of rules: our step-free rules wouldn't apply outdoors, and picking the best entrance gets hard. Its API key would be visible in the browser, and the free plan has daily limits. Our own OpenStreetMap import gives one route with one set of rules. Keep ORS only if we ever route from off campus, through an Edge Function so the key stays hidden. |
| QGIS / geojson.io | Digitising floor plans | **Keep QGIS**, geojson.io for quick fixes | QGIS is a free desktop map editor. We lay each floor-plan image over the real map so it lines up (georeferencing), then trace rooms, doors and corridors on top and export them as GeoJSON. geojson.io is a website for small edits to that file. Add an import script, like the OpenStreetMap one. |
| vite-plugin-pwa + IndexedDB | Offline use | **Keep**, use idb-keyval | Both maintained. `idb-keyval` is a tiny wrapper that makes IndexedDB easy for storing the graph. Signal is patchy inside buildings, so this matters more campus-wide. |
| ESLint, with the import rule | Code checks and the folder rules | **Replace with Oxlint** | ESLint's accessibility plugin (jsx-a11y) hasn't had a release since October 2024 and doesn't support ESLint 10, the current version. Oxlint has the same accessibility rules and `no-restricted-imports` built in, supports TypeScript 7, and is much faster. Per-folder rules use its `overrides` setting. |
| GitHub Actions | CI | **Keep** | Run type check, lint, tests, database tests and data checks on every pull request. |

## What to add

| Library or tool | For | Why |
|---|---|---|
| React Router 8 | Screens | Each screen gets its own web address, so the back button works and a link can open a route directly, for example from a university web page or an event email. |
| Campus background layers (our own code, no library) | Background map | The buildings, paths and green spaces drawn under our routes. Extend the OpenStreetMap download to include building outlines and green spaces, and draw them as Leaflet layers in our own high-contrast colours. No API key, no usage limits, works offline, and the map shows exactly the paths we route on. We don't use protomaps-leaflet: it went into maintenance mode in February 2026, and its makers recommend MapLibre for new projects. OpenStreetMap's own tile servers don't allow heavy use or offline caching. |
| MiniSearch | Search | Finds rooms and facilities as you type, tolerating typos and other names ("4W 1.01", "4 West", "library", "accessible toilet"). Runs in the browser, so it works offline. Small and stable (7.2). |
| Supabase Auth (Microsoft provider) | Staff logins | Staff sign in with their university account to update closures and data. No new passwords. |
| Sentry (`@sentry/react`) | Error monitoring | Tells the team when the site breaks on someone's phone, with the error and the browser. The free plan allows one user; the Team plan (unlimited users) is $26 a month. |
| Oxlint | Code checks | Replaces ESLint (above). Catches code mistakes and accessibility problems (missing labels, alt text, keyboard problems) as code is written, and enforces the folder rules. |
| Testing Library | Component tests | Tests screens the way a user, or a screen reader, finds things. |
| Playwright + @axe-core/playwright | End-to-end and accessibility tests | Runs the real site in a browser and checks each screen with axe. |
| PGlite | Database tests | A full Postgres in Node: CI checks every migration and the seed with no Docker and no Supabase project. |
| Supabase CLI | Applying migrations | CI applies migrations to staging, then production, instead of anyone pasting SQL by hand. |

## Architecture decisions

- **One repo** with `frontend/` and `backend/`. A schema change ships in the
  same pull request as the code that uses it. A `CODEOWNERS` file makes
  changes to `backend/` need the backend lead's review, and `frontend/` the
  frontend lead's.
- **No custom server.** Supabase serves the data. Edge Functions only for work
  that truly needs a server.
- **Routing in the browser.** Instant, no server costs, and it works offline.
  Campus scale is fine with a priority queue and loading by area.
- **Text directions come first, the map second.** A blind user must be able to
  get a complete route without the map. The map is there for those who can use
  it.
- **The folder rules** (only `repositories/` talks to Supabase). New parts
  follow them: graph building in `utils/`, caching in `services/`.
- **Two environments.** Staging for testing changes and data, production for
  the public. Nothing reaches production without passing staging.

## Database

**Written and tested (migrations 0002 and 0003):**
- **Row Level Security** on every table: the public key can only read.
- **Edges gain a kind** (corridor, door, stairs, ramp, lift, outdoor),
  **one-way direction**, step count, door width, automatic door, signed slope,
  and extra seconds for lift rides.
- **`accessible` no longer defaults to true.** Empty means "not surveyed."
- **Floors get sign labels** ("Level 1"), and outdoor nodes (no floor) are
  allowed.
- **One source of truth for coordinates:** each building gets an alignment
  record, and the `nodes_geo` view works out map positions from x/y.
- **Edge lengths fill themselves in** on one floor, and a warnings view flags
  mistyped lengths.
- **A `closures` table** for broken lifts and locked doors.
- **Stricter rules:** no duplicate edges, no stairs marked step-free.
- **OpenStreetMap import columns:** `source` and `osm_id`, so re-imports
  replace only imported rows, plus `shape` for drawing curved paths.

**Still needed for the whole university (a migration 0004, not written yet):**
- **Destinations.** Rooms are just nodes today. A whole-campus site needs a
  list of places people look for, with categories: lecture theatres, offices,
  toilets, accessible toilets, Changing Places toilets, lifts, cafés, quiet
  rooms, first aid. Each destination also needs other names people use.
- **Permanent access rules.** Closures handle "lift broken today". The campus
  also has card-access doors, staff-only areas and buildings locked at night.
  Edges need an access type (public, card, staff only) and opening hours, so
  routes never go through a door the user can't open.
- **Building details:** full name, short code, address, and opening hours.
- **Staff write access.** Row Level Security policies that let signed-in
  staff edit closures (and, for some, data), with every change logged with who
  made it and when.
- **Problem reports.** A table for "report a problem" from the public, with
  insert-only access and a rate limit.

## Routing

- **Three route types:**
  - **Fastest.**
  - **Step-free:** never uses stairs, steps, doors narrower than 775 mm, or
    slopes steeper than 1:12. The limits come from UK Approved Document M.
  - **Avoid stairs:** uses stairs only when that saves more than 2 minutes.
- **Costs are in seconds:** walking time + extra seconds + route-type
  penalties.
- **Closures block an edge for every route type.** Closing a lift blocks all
  of its connections.
- **Directions read out lifts, stairs, ramps and doors** with the floor's sign
  label.
- **The route screen shows the estimated time** and warns about unsurveyed
  connections on step-free routes.
- **Still needed:** routes across buildings (picking the best entrance for the
  route type), outdoor directions ("leave by the north entrance, follow the
  path past the library"), access rules and opening hours, and the priority
  queue.

## Data

Software is the smaller part of this project. Collecting and maintaining
accurate data for every building is the larger one, and the riskiest.

### Indoor

1. **Permission first.** Detailed public floor plans can be a security
   concern. Agree with Estates and Security which buildings and areas can be
   published, and at what detail, before tracing.
2. **Trace in QGIS** from the floor plans Estates provides, then load with an
   import script into staging.
3. **Check automatically in CI** on every data change:
   - every destination can be reached;
   - every destination can be reached step-free, or is listed as not;
   - no mistyped lengths (the `edge_length_warnings` view);
   - lifts connect every floor they serve.
4. **Survey on site** before a building goes live: door widths, automatic
   doors, ramps, lifts, steps. Use one survey form so everyone records the
   same things.

### Outdoor

`backend/osm/import-osm.mjs` downloads the campus from OpenStreetMap and
converts it into our tables. The first run, on 31 October 2026, found:

| | Count |
|---|---|
| Nodes | 1,124 |
| Edges (about 41 km of paths and roads) | 1,315 |
| Flights of steps | 32 |
| Building entrances | 142 |
| Entrances with a wheelchair tag | 1 |
| Entrances with door type or width | 0 |

The paths are well mapped, but there's almost no accessibility information.
The script writes `entrances-to-survey.csv` as the survey to-do list. Put what
we learn back into OpenStreetMap: the Organised Editing Guidelines ask a team
to post a notice at least 2 weeks before editing together. Re-import every
term.

### Keeping it current

- **Closures:** a simple staff page (signed in with the university account)
  to close and reopen a lift, door or path, with an optional end time.
- **Building changes:** each building has a named data owner who reviews
  changes after refurbishments. Changes go to staging, are checked, then
  published.
- **Problem reports:** a "report a problem with this route" link on every
  route, reviewed weekly.
- **Data age:** the site shows when closures were last updated, especially
  when offline.

## Hosting and environments

The website is static: a folder of files that Vite builds. Supabase is the
backend and routing runs on the phone, so there's no server of our own to host.

**Suggestion: Cloudflare Workers (static files).** Cloudflare now recommends
Workers instead of Pages for new projects; for a static site the deal is the
same.
- Free with no credit card, so there's no risk of a surprise bill.
- Requests for static files are free and unlimited, so open days and
  freshers' week are no problem.
- Built in: HTTPS, custom web addresses, deploys from GitHub on every merge,
  preview links for other branches, and the "send every path to index.html"
  setting React Router needs (`not_found_handling: "single-page-application"`).
- Free-plan limits (25 MiB per file, 20,000 files, 3,000 build minutes a
  month, one build at a time) are far above what we need. Check the current
  terms before signing up.

**If the university can give us an account,** use what it already runs instead
(probably Azure, with Azure Static Web Apps). For an official university
service this is the stronger option: University IT can own it, a `bath.ac.uk`
address is easier, and the site outlives the team. Ask IT first.

Other options that would also work: Netlify, Vercel (free plan is
non-commercial only), Firebase Hosting, AWS Amplify. Moving between them later
is small, since they all serve the same files.

**Environments:**

| | Staging | Production |
|---|---|---|
| Website | Preview links and a staging address | The public address |
| Database | Its own Supabase project, in a separate free organisation | Its own Supabase project, Pro plan, daily backups |
| Updated by | Every merge to `main` | A release, after checks pass on staging |

**Web address:** ask University IT for one such as `wing.bath.ac.uk` early.
Once links, posters and web pages point to an address, changing it is painful.

## Security and privacy

- **Row Level Security on every table** (migration 0002): the public can only
  read. Staff writes go through signed-in roles, and are logged.
- **Secrets:** the anon key is public by design. The service-role key never
  goes in the website or the repo. Add a `.gitignore` and stop committing
  `node_modules` and `.env`, as TASKS Phase 0 says.
- **Location stays on the phone.** Routing runs in the browser, so the site
  never sends where a user is or where they're going to our servers. Keep it
  that way, and say so in the privacy notice.
- **Privacy notice and GDPR:** agree a privacy notice with the university's
  data protection team. If we add usage statistics, use a cookie-free,
  privacy-friendly tool, or none.
- **Sensitive areas:** some rooms or routes may not be published at all, as
  agreed with Security.

## Accessibility

UK universities are covered by the Public Sector Bodies Accessibility
Regulations 2018. In practice that means WCAG 2.2 AA and a published
accessibility statement. For a site built for disabled users, we should aim
higher.

- **Built in from the start:**
  - text directions that work with screen readers;
  - large text and zoom support;
  - high contrast;
  - full keyboard use;
  - reduced motion;
  - a clear announcement on every screen change.
- **Checked automatically:** Oxlint's accessibility rules while coding, axe on
  every screen in CI.
- **Checked by people:** VoiceOver on iPhone and TalkBack on Android before
  each release.
- **Before launch:** a full accessibility audit (the university's digital
  accessibility team, or an external auditor), and testing with disabled
  students and staff, with Disability Services' help.
- **Accessibility statement** published at launch, listing anything not yet
  compliant and how to report problems.
- **Works on ordinary phones:** older and cheaper phones, and slow
  connections, not just new iPhones.

## Reliability and support

- **Error alerts** from Sentry. The free plan allows one user, so one lead
  receives them unless we pay for the Team plan.
- **An uptime check** on the live address (many free services do this).
- **Backups:** daily on Supabase Pro. Test a restore once a term.
- **Offline fallback:** the last downloaded data still gives routes when the
  connection drops.
- **A contact route:** "report a problem" on every route, and a named team
  inbox in the accessibility statement.

## Ownership and handover

Students graduate every year, so the project has to survive without any one
of them.

- **A university staff owner** (from IT, Estates or Disability Services) who
  holds the accounts and makes decisions when the team changes.
- **Accounts belong to the university or the team:** GitHub organisation,
  hosting, Supabase, Sentry, and the domain, each with at least two admins,
  including a staff member.
- **Documentation:** setup in the README, how to add a building, how to run
  the imports, how to release, and a decision log (this document is the
  first entry).
- **A handover each year:** outgoing leads brief incoming ones, and CODEOWNERS
  is updated.

## Costs

| Item | Cost |
|---|---|
| Hosting (Cloudflare Workers) | Free |
| Supabase production (Pro) | About $25 a month |
| Supabase staging | Free plan, in a separate free organisation (about $10 a month if inside the Pro organisation) |
| Sentry | Free for one user, or $26 a month for the whole team (Team plan) |
| Web address | Free if `bath.ac.uk`, otherwise about £10–20 a year |
| **Total** | **About $25 a month** (roughly £20), or about $51 with Sentry Team |

Prices are from public pricing pages and change; check before budgeting. The
cost needs a university budget holder, not a student's card.

## Status

| Item | State |
|---|---|
| Migrations 0002 and 0003 | Written and tested on PGlite, on the branch, not applied to Supabase |
| Route types, closures, one-way edges, directions | Written, 19 tests passing, on the branch |
| OpenStreetMap import | Written, tested, first Bath snapshot fetched, on the branch |
| Priority queue in route finding | Not done |
| Building selection, routes across buildings | Not done |
| Migration 0004 (destinations, access rules, staff access, problem reports) | Not done |
| Search | Not done |
| Staff page and logins | Not done |
| Version upgrades (React 19, TypeScript 7, Vite 8, Vitest 5) | Not done |
| React Router | Not done |
| Leaflet map and campus background layers | Not done |
| Floor-plan import script and data checks in CI | Not done |
| Oxlint, accessibility tests, CI | Not done |
| Error monitoring | Not done |
| `.gitignore`, removing `node_modules` and `.env` from git | Not done |
| Staging and production environments | Not set up |
| Hosting | Cloudflare Workers suggested, not agreed |
| University staff owner, floor-plan permission, budget | Not agreed |

Nothing on the branch is committed yet.

## Roadmap to launch

1. **Foundations.** Phase 0 as TASKS.md has it, plus version upgrades,
   migration 0002, `.gitignore`, CI, CODEOWNERS, staging and production
   environments. In parallel: agree a staff owner, floor-plan permission and
   budget with the university.
2. **Pilot building.** One real building end to end: traced, surveyed,
   imported, routed, with the Leaflet map, React Router, search and text
   directions. Test it with disabled users.
3. **Pilot area.** Two or three neighbouring buildings and the paths between
   them: the OpenStreetMap import, entrance linking, routes across buildings,
   the priority queue, migration 0004.
4. **Staff tools.** Staff logins, the closures page, problem reports, data
   checks in CI.
5. **Whole campus.** Trace and survey the remaining public buildings, a few at
   a time, each through staging and data checks.
6. **Launch readiness.** Offline use, error monitoring, the accessibility
   audit and statement, the privacy notice, the official address. Soft-launch
   to a group of students, then launch publicly.
7. **After launch.** Termly OpenStreetMap re-imports, a yearly handover, and
   updates as buildings change. Then the ideas below.

## Ideas for after launch

### Directions to your next class

A student signs in and the home screen shows their next class with one tap to
directions:

> **Next: Software Engineering lecture, 11:15, 8 West 2.5**
> 9 minutes step-free · **Get directions**

Ways to get the timetable, simplest first:

| Option | How | Personal data on our side |
|---|---|---|
| 1. Links from the timetable | The university's timetable page or app adds a "Directions" link to each room, e.g. `wing.bath.ac.uk/route?to=8W-2.5`. React Router already makes this work. | None |
| 2. Outlook calendar | If timetables are copied into students' Outlook calendars, a student signs in with their university Microsoft account and allows "read my calendar". The browser reads the next few events through Microsoft Graph (`@azure/msal-browser` for sign-in). IT registers WING with Microsoft and approves the permission. | None: it goes from Microsoft to the phone |
| 3. Personal calendar link | Students paste the private "subscribe to your timetable" link. Browsers usually can't fetch it directly, so it needs a server function in between. | Yes |
| 4. Timetable system access | A formal link to the university's timetabling system. | Yes |

**Suggestion:** offer option 1 and "favourite rooms" (saved on the phone) at
launch, since neither uses personal data. Add option 2 after launch if IT
confirms timetables are in Outlook. Avoid options 3 and 4 unless IT offers
them.

**Needs:**
- room names in the timetable matched to our destinations (the "other names"
  in migration 0004);
- opt-in only: the site works fully without signing in;
- the timetable read in the browser and not stored, apart from a short cache
  on the phone;
- agreement from the data protection team, probably with a privacy assessment
  (DPIA);
- an accessible "next class" card that says clearly when there's no step-free
  route.

## Decisions needed

**From the team:**
1. Do we agree to replace OpenRouteService with our own OpenStreetMap import
   for on-campus routes?
2. Who leads the indoor survey, and what goes on the survey form?
3. Which building is the pilot?

**From the university:**
4. Who is the staff owner of WING?
5. Can University IT host it and give us a `bath.ac.uk` address, or do we use
   Cloudflare Workers? Who owns the accounts?
6. Can we have the floor plans, and which buildings and areas may be
   published?
7. Who pays for the Supabase Pro plan (about $25 a month)?
8. Who can update closures, and can they sign in with university accounts?
9. Will Disability Services and the digital accessibility team help test and
   audit?
10. Who posts the OpenStreetMap team-editing notice before we start editing?
11. Which timetable system does the university use, are timetables copied
    into Outlook, and would the timetable team add WING links to rooms?
