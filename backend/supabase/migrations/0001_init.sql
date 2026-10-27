-- WING database schema (Supabase / Postgres)
-- Apply via `supabase db push`, or paste into the Supabase SQL editor.

create table buildings (
  id text primary key,          -- e.g. '4W' (4 West)
  name text not null
);

create table floors (
  id text primary key,          -- e.g. '4W-1' (4 West, floor 1)
  building_id text references buildings(id),
  level integer not null        -- 0 = ground, 1 = first floor, etc. Matches map-gl-indoor's `level` tag
);

-- Every scannable QR checkpoint AND every routing junction is a "node".
-- A room like 1.01 is a node with type='room'; a corridor junction is type='junction'.
create table nodes (
  id text primary key,          -- e.g. '4W-1.01'
  floor_id text references floors(id),
  type text not null check (type in ('room', 'junction', 'stairs', 'lift', 'exit')),
  label text not null,          -- human-readable, e.g. "Room 1.01"
  x float not null,             -- local floor-plan coordinates (metres), used for routing distance
  y float not null,
  lng float,                    -- real-world coords, used for map-gl-indoor rendering
  lat float
);

-- Edges = corridor segments / connections between nodes. Undirected, weighted by distance.
create table edges (
  id serial primary key,
  from_node text references nodes(id),
  to_node text references nodes(id),
  weight float not null,        -- distance in metres, used directly as the Dijkstra edge cost
  accessible boolean default true  -- false for step-only connections (e.g. a short flight of stairs used as a shortcut)
);

-- The actual QR code -> node mapping. This is the table that answers
-- "the code the user just scanned corresponds to which node?"
create table qr_codes (
  code text primary key,        -- the literal string encoded in the QR image, e.g. 'WING-4W-1.01'
  node_id text references nodes(id)
);
