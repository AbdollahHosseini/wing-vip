/**
 * Pure function: a building's floors, nodes and edges in, a routable graph
 * out. No React, no database. It lives here rather than in
 * graphRepository.ts so the direction rules (two-way vs one-way edges) can
 * be tested without Supabase.
 */
import type { Edge, Floor, Graph, Node } from '../types/domain';

export function buildGraph(floors: Floor[], nodes: Node[], edges: Edge[]): Graph {
  const adjacency: Graph['adjacency'] = new Map();
  const add = (edge: Edge) => {
    if (!adjacency.has(edge.fromNodeId)) adjacency.set(edge.fromNodeId, []);
    adjacency.get(edge.fromNodeId)!.push(edge);
  };

  edges.forEach((edge) => {
    add(edge);
    if (!edge.oneWay) add(reversed(edge));
  });

  return {
    nodes: new Map(nodes.map((n) => [n.id, n])),
    floors: new Map(floors.map((f) => [f.id, f])),
    adjacency,
  };
}

/** The same edge walked the other way: ends swapped, uphill becomes downhill. */
function reversed(edge: Edge): Edge {
  return {
    ...edge,
    fromNodeId: edge.toNodeId,
    toNodeId: edge.fromNodeId,
    slopePct: edge.slopePct === null ? null : -edge.slopePct,
  };
}
