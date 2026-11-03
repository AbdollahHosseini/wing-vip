## What changed

<!-- What this pull request does and why. Link the task or issue, for example "Closes #12". -->

## How it was checked

<!-- What you ran or tried: tests added, steps clicked through in `npm run dev`, the browser and screen reader used. -->

## Checklist

<!-- Tick each box. If one doesn't apply, tick it and add "n/a". -->

- [ ] `npm test`, `npm run lint` and `npm run build` pass in `frontend/`
- [ ] Changed `frontend/wrangler.jsonc`? `npm run deploy:check` passes
- [ ] Changed `backend/osm/`? Ran `node backend/osm/import-osm.mjs build` from the repo root and committed the snapshot, `outdoor-import.sql` and `entrances-to-survey.csv` together
- [ ] No secrets in the diff: no `.env` file, no keys or passwords, no Supabase secret key (`sb_secret_...`) or `service_role` key
- [ ] Database changes are in a new migration file in `backend/supabase/migrations/`; no existing migration was edited
- [ ] UI changes work with the keyboard alone and with a screen reader (VoiceOver, NVDA or TalkBack)
- [ ] UI changes have screenshots below

## Screenshots

<!-- UI changes only: before and after, each with a one-line description for reviewers using a screen reader. -->
