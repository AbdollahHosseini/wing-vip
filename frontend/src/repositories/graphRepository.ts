/**
 * The ONLY file (besides qrRepository.ts, closureRepository.ts and
 * supabaseClient.ts) allowed to import @supabase/supabase-js for graph data.
 * If you're writing a component or a util and you need `supabase.from(...)`,
 * that's the signal you're in the wrong layer — come back here instead.
 *
 * Responsibility: fetch a building's floors/nodes/edges from Supabase and
 * convert the rows into the app's domain types. Turning them into a
 * routable graph, and caching it, happens in services/GraphService.ts.
 */
import { supabase } from './supabaseClient';
import type { Edge, Floor, Node } from '../types/domain';

export interface BuildingData {
  floors: Floor[];
  nodes: Node[];
  edges: Edge[];
}

export async function fetchBuildingData(buildingId: string): Promise<BuildingData> {
  const { data: floorRows, error: floorErr } = await supabase
    .from('floors')
    .select('id, building_id, level, label')
    .eq('building_id', buildingId);
  if (floorErr) throw floorErr;
  const floorIds = floorRows.map((f) => f.id);

  // nodes_geo = nodes plus map coordinates worked out from the building's
  // alignment record (see migration 0002), so x/y and lng/lat can't drift.
  const { data: nodeRows, error: nodeErr } = await supabase
    .from('nodes_geo')
    .select('*')
    .in('floor_id', floorIds);
  if (nodeErr) throw nodeErr;

  const { data: edgeRows, error: edgeErr } = await supabase
    .from('edges')
    .select('*')
    .in('from_node', nodeRows.map((n) => n.id));
  if (edgeErr) throw edgeErr;

  const floors: Floor[] = floorRows.map((row) => ({
    id: row.id,
    buildingId: row.building_id,
    level: row.level,
    label: row.label,
  }));

  const nodes: Node[] = nodeRows.map((row) => ({
    id: row.id,
    floorId: row.floor_id,
    kind: row.type,
    label: row.label,
    x: row.x,
    y: row.y,
    lng: row.map_lng,
    lat: row.map_lat,
  }));

  const edges: Edge[] = edgeRows.map((row) => ({
    id: row.id,
    fromNodeId: row.from_node,
    toNodeId: row.to_node,
    kind: row.kind,
    weightMetres: row.weight,
    extraSeconds: row.extra_seconds,
    oneWay: row.one_way,
    accessible: row.accessible,
    stepCount: row.step_count,
    doorWidthMetres: row.door_width_m,
    automaticDoor: row.automatic_door,
    slopePct: row.slope_pct,
  }));

  return { floors, nodes, edges };
}
