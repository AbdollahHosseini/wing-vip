-- WING migration 0003: room for data imported from OpenStreetMap.
-- Runs after 0002. Used by backend/osm/import-osm.mjs.
--
-- `source` says who owns a row. Rows with source = 'osm' belong to the
-- import: re-running it replaces them, so never hand-edit them — fix the
-- data in OpenStreetMap instead, or add a 'manual' row. The default is
-- 'manual', so everything the team enters by hand is left alone.

alter table nodes
  add column source text not null default 'manual',
  add column osm_id bigint,
  add constraint nodes_source_valid check (source in ('manual', 'osm'));

create unique index nodes_osm_id_idx on nodes (osm_id) where osm_id is not null;

alter table edges
  add column source text not null default 'manual',
  add column osm_way_id bigint,
  -- The path's real shape as [[lng, lat], ...], for drawing the route line.
  -- Outdoor paths bend between junctions; null means "draw a straight line".
  add column shape jsonb,
  add constraint edges_source_valid check (source in ('manual', 'osm'));

create index edges_source_idx on edges (source);
