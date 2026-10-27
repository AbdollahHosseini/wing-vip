-- Minimal seed data: one floor of one building, enough nodes to route
-- from Room 1.01 to Room 1.08, passing through two corridor junctions.
-- This is the exact example used in tests/dijkstra.test.ts.
--
--   [1.01]---(j1)---(j2)---[1.08]
--                     |
--                  [lift-1]

insert into buildings (id, name) values ('4W', '4 West');

insert into floors (id, building_id, level) values ('4W-1', '4W', 1);

insert into nodes (id, floor_id, type, label, x, y, lng, lat) values
  ('4W-1.01',   '4W-1', 'room',     'Room 1.01', 0,  0,  -2.3263, 51.3800),
  ('4W-1-J1',   '4W-1', 'junction', 'Junction A', 8,  0,  -2.3262, 51.3800),
  ('4W-1-J2',   '4W-1', 'junction', 'Junction B', 16, 0,  -2.3261, 51.3800),
  ('4W-1.08',   '4W-1', 'room',     'Room 1.08', 24, 0,  -2.3260, 51.3800),
  ('4W-1-LIFT', '4W-1', 'lift',     'Lift 1',     16, 6,  -2.3261, 51.3801);

insert into edges (from_node, to_node, weight, accessible) values
  ('4W-1.01',   '4W-1-J1',   8, true),
  ('4W-1-J1',   '4W-1-J2',   8, true),
  ('4W-1-J2',   '4W-1.08',   8, true),
  ('4W-1-J2',   '4W-1-LIFT', 6, true);

-- The QR code physically stuck on the wall outside Room 1.01
insert into qr_codes (code, node_id) values
  ('WING-4W-1.01', '4W-1.01'),
  ('WING-4W-1.08', '4W-1.08'),
  ('WING-4W-1-J1', '4W-1-J1'),
  ('WING-4W-1-J2', '4W-1-J2');
