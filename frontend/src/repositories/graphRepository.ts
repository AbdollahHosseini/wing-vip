/**
 * The ONLY file (besides qrRepository.ts and supabaseClient.ts) allowed
 * to import @supabase/supabase-js for graph data. If you're writing a
 * component or a util and you need `supabase.from(...)`, that's the
 * signal you're in the wrong layer — come back here instead.
 *
 * Responsibility: fetch nodes/edges from Supabase, convert them into the
 * app's domain types, and cache the result in memory so we don't refetch
 * on every route calculation (the graph is small — a few hundred nodes —
 * and doesn't change while the user is navigating one session).
 */
import { supabase } from './supabaseClient';
import type { Graph, Node } from '../types/domain';

const cache = new Map<string, Graph>();

export async function fetchGraph(buildingId: string): Promise<Graph> {
  const cached = cache.get(buildingId);
  if (cached) return cached;

  const { data: floorRows, error: floorErr } = await supabase
    .from('floors')
    .select('id')
    .eq('building_id', buildingId);
  if (floorErr) throw floorErr;
  const floorIds = floorRows.map((f) => f.id);

  const { data: nodeRows, error: nodeErr } = await supabase
    .from('nodes')
    .select('*')
    .in('floor_id', floorIds);
  if (nodeErr) throw nodeErr;

  const { data: edgeRows, error: edgeErr } = await supabase
    .from('edges')
    .select('*')
    .in('from_node', nodeRows.map((n) => n.id));
  if (edgeErr) throw edgeErr;

  const nodes = new Map<string, Node>();
  nodeRows.forEach((row) =>
    nodes.set(row.id, {
      id: row.id,
      floorId: row.floor_id,
      kind: row.type,
      label: row.label,
      x: row.x,
      y: row.y,
      lng: row.lng,
      lat: row.lat,
    })
  );

  const adjacency = new Map<string, { neighbourId: string; weightMetres: number }[]>();
  const addEdge = (a: string, b: string, weightMetres: number) => {
    if (!adjacency.has(a)) adjacency.set(a, []);
    adjacency.get(a)!.push({ neighbourId: b, weightMetres });
  };
  edgeRows.forEach((row) => {
    addEdge(row.from_node, row.to_node, row.weight);
    addEdge(row.to_node, row.from_node, row.weight); // undirected
  });

  const graph: Graph = { nodes, adjacency };
  cache.set(buildingId, graph);
  return graph;
}
