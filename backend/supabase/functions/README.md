# Reserved for Edge Functions

Empty on purpose. This is the one place in the WING stack that's an actual
server receiving a request and deciding what to do — the closest thing to
a classic backend "controller" in this architecture.

Nothing in the app currently needs this: routing runs client-side, and all
reads/writes go straight through Supabase's auto-generated API via the
`repositories/` layer.

Add a function here only when something genuinely needs to run on the
server — e.g. validating a bulk GeoJSON floor-plan import, or rate-limiting
scans. If you're tempted to add one "just in case," don't — that's a sign
the logic belongs in `src/services/` instead.
