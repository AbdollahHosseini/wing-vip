-- WING migration 0002: security, accessibility data, routing costs, closures.
-- Runs on top of 0001_init.sql; seed.sql is applied after all migrations.
-- Apply as described in README.md, "Setting up the backend".


-- 1. Security ---------------------------------------------------------------
-- The frontend ships Supabase's public anon key. Without Row Level Security,
-- anyone holding that key can insert, update and delete every row. With RLS on
-- and only SELECT policies, the app can read but never write. The team edits
-- data through the Supabase dashboard, SQL editor or CLI, which bypass RLS.

alter table buildings enable row level security;
alter table floors    enable row level security;
alter table nodes     enable row level security;
alter table edges     enable row level security;
alter table qr_codes  enable row level security;

create policy "Public read" on buildings for select to anon, authenticated using (true);
create policy "Public read" on floors    for select to anon, authenticated using (true);
create policy "Public read" on nodes     for select to anon, authenticated using (true);
create policy "Public read" on edges     for select to anon, authenticated using (true);
create policy "Public read" on qr_codes  for select to anon, authenticated using (true);

-- Supabase's Data API only sees tables and views a role has been granted
-- privileges on, so everything the app reads gets an explicit grant.
grant select on buildings, floors, nodes, edges, qr_codes to anon, authenticated;


-- 2. Floors -----------------------------------------------------------------
-- `level` stays the number the map uses to pick which floor to show. `label`
-- is what the building's own signs say, which is what directions should read
-- out ("Level 1", "LG").
-- Bath buildings have entrances on different levels, so never assume level 0
-- is the street.

alter table floors add column label text;
update floors set label = 'Level ' || level where label is null;
alter table floors
  alter column label set not null,
  alter column building_id set not null,
  add constraint floors_one_per_level unique (building_id, level);


-- 3. One source of truth for coordinates ---------------------------------------
-- Nodes are placed in local floor-plan metres (x, y). Each building gets one
-- alignment record that turns those metres into map coordinates, so x/y and
-- lng/lat can no longer drift apart:
--   origin_lng, origin_lat  where the floor plan's (0, 0) sits on the map
--   rotation_deg            angle from due east to the plan's +x axis,
--                           counter-clockwise
-- The nodes_geo view computes map_lng / map_lat from that record. Until a
-- building has an origin, it falls back to the node's own lng / lat, so
-- existing data keeps working. The frontend reads nodes_geo. Keep
-- nodes.lng / nodes.lat even once every building is aligned: outdoor nodes
-- (below) are placed by them, and nodes_geo depends on them.

alter table buildings
  add column origin_lng float,
  add column origin_lat float,
  add column rotation_deg float not null default 0,
  add constraint buildings_origin_complete
    check ((origin_lng is null) = (origin_lat is null));

-- Outdoor nodes (paths between buildings, for later) have no floor. They are
-- placed by lng / lat directly, and their x / y are not used for routing.
alter table nodes
  add constraint nodes_outdoor_need_coords
    check (floor_id is not null or (lng is not null and lat is not null));

create index nodes_floor_id_idx on nodes (floor_id);

-- Flat-earth conversion: accurate to centimetres across a single building.
create view nodes_geo with (security_invoker = true) as
select
  n.*,
  coalesce(
    b.origin_lng
      + (n.x * cos(radians(b.rotation_deg)) - n.y * sin(radians(b.rotation_deg)))
        / (111320 * cos(radians(b.origin_lat))),
    n.lng
  ) as map_lng,
  coalesce(
    b.origin_lat
      + (n.x * sin(radians(b.rotation_deg)) + n.y * cos(radians(b.rotation_deg)))
        / 111320,
    n.lat
  ) as map_lat
from nodes n
left join floors f on f.id = n.floor_id
left join buildings b on b.id = f.building_id;

grant select on nodes_geo to anon, authenticated;


-- 4. Edges: accessibility data and direction --------------------------------------
-- `accessible` now means:
--   true   surveyed and step-free
--   false  has steps, or is otherwise unusable in a wheelchair
--   null   not surveyed yet. The app must not treat this as step-free.
-- Existing rows keep their values; only the "assume accessible" default goes.
--
-- Direction: with one_way = false, an edge works both ways. With
-- one_way = true, it only runs from_node -> to_node (exit-only doors,
-- escalators). slope_pct is signed in the from_node -> to_node direction, so
-- a ramp that climbs from A to B is positive when stored as A -> B.

create type edge_kind as enum ('corridor', 'door', 'stairs', 'ramp', 'lift', 'outdoor');

alter table edges
  add column kind edge_kind not null default 'corridor',
  add column one_way boolean not null default false,
  add column step_count integer,
  add column door_width_m float,
  add column automatic_door boolean,
  add column slope_pct float,
  add column extra_seconds float not null default 0;

alter table edges
  alter column accessible drop default,
  alter column from_node set not null,
  alter column to_node set not null,
  add constraint edges_no_self_loop check (from_node <> to_node),
  add constraint edges_weight_not_negative check (weight >= 0),
  add constraint edges_step_count_valid check (step_count is null or step_count >= 0),
  add constraint edges_door_width_valid check (door_width_m is null or door_width_m > 0),
  add constraint edges_slope_valid check (slope_pct is null or slope_pct between -100 and 100),
  add constraint edges_extra_seconds_valid check (extra_seconds >= 0),
  add constraint edges_stairs_not_step_free check (kind <> 'stairs' or accessible is not true);

-- The same connection can't be entered twice: once per pair for two-way
-- edges (in either order), once per direction for one-way edges.
create unique index edges_unique_two_way
  on edges (least(from_node, to_node), greatest(from_node, to_node), kind)
  where not one_way;
create unique index edges_unique_one_way
  on edges (from_node, to_node, kind)
  where one_way;

create index edges_from_node_idx on edges (from_node);
create index edges_to_node_idx on edges (to_node);


-- 5. Routing cost in seconds ------------------------------------------------------
-- `weight` stays the walking length in metres. Dijkstra should use time, not
-- metres, so lifts and stairs compare fairly with corridors:
--
--   cost = weight / walking_speed + extra_seconds + profile penalties
--
-- where the profile (fastest, step-free, avoid stairs) blocks or penalises
-- edges by kind, accessible, step_count, door_width_m and slope_pct.
--
-- Lifts: give each lift one node per floor, and join neighbouring floors with
-- a 'lift' edge: weight 0 (no walking) and extra_seconds for the ride plus
-- the wait, e.g. 30. Stairs: a 'stairs' edge per flight, with step_count.
--
-- `weight` can now be left out when adding an edge between two nodes on the
-- same floor: it is filled from their x / y. Edges between floors, or with
-- an outdoor end, still need it typed in.

create function edges_fill_weight() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  a public.nodes;
  b public.nodes;
begin
  if new.weight is null then
    select * into a from public.nodes where id = new.from_node;
    select * into b from public.nodes where id = new.to_node;
    if a.floor_id is not null and a.floor_id = b.floor_id then
      new.weight := sqrt(power(a.x - b.x, 2) + power(a.y - b.y, 2));
    end if;
  end if;
  return new;
end;
$$;

create trigger edges_fill_weight
  before insert or update on edges
  for each row execute function edges_fill_weight();

-- Edges whose typed-in length is more than 20% off the straight line between
-- their nodes. Corridors that bend can be longer, but a shorter weight is
-- always a data error. Check this view after adding a floor.
create view edge_length_warnings with (security_invoker = true) as
select
  e.id,
  e.from_node,
  e.to_node,
  e.weight,
  round(sqrt(power(a.x - b.x, 2) + power(a.y - b.y, 2))::numeric, 2) as straight_line_m
from edges e
join nodes a on a.id = e.from_node
join nodes b on b.id = e.to_node
where a.floor_id = b.floor_id
  and abs(e.weight - sqrt(power(a.x - b.x, 2) + power(a.y - b.y, 2)))
      > 0.2 * greatest(sqrt(power(a.x - b.x, 2) + power(a.y - b.y, 2)), 1);


-- 6. Closures -----------------------------------------------------------------------
-- A lift out of service or a locked door. Exactly one of node_id / edge_id is
-- set. Routing skips anything in active_closures, so a broken lift needs one
-- row here, not a data edit. Closing a lift node closes every edge to it.
-- An edge with a closure can't be deleted (restrict), so re-running the OSM
-- import stops instead of dropping an edge closure. A node closure is
-- deleted with its node (cascade): if the import removes an OSM node, its
-- closure goes too. See backend/osm/README.md.

create table closures (
  id bigint generated always as identity primary key,
  node_id text references nodes (id) on delete cascade,
  edge_id integer references edges (id) on delete restrict,
  reason text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  constraint closures_one_target check (num_nonnulls(node_id, edge_id) = 1),
  constraint closures_ends_after_start check (ends_at is null or ends_at > starts_at)
);

alter table closures enable row level security;
create policy "Public read" on closures for select to anon, authenticated using (true);

create view active_closures with (security_invoker = true) as
select *
from closures
where starts_at <= now()
  and (ends_at is null or ends_at > now());

-- The view runs with the reader's rights, so it needs closures too.
grant select on closures, active_closures to anon, authenticated;


-- 7. QR codes -----------------------------------------------------------------------
-- Every code must point somewhere.

alter table qr_codes alter column node_id set not null;
create index qr_codes_node_id_idx on qr_codes (node_id);
