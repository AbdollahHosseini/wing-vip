/**
 * Pure function: no React, no database, no side effects — input in,
 * answer out. This is what lets a teammate test or swap the algorithm
 * (e.g. Dijkstra -> A*) without touching a single component.
 *
 * The caller decides what each edge costs (see routeCost.ts), so the same
 * search serves every route type. An edge costing Infinity is skipped.
 *
 * For a graph this size (a few hundred nodes at most) a plain O(V^2)
 * scan is more than fast enough — no need for a priority queue.
 */
import type { Edge, Graph } from '../types/domain';

export function findShortestPath(
  graph: Graph,
  startId: string,
  endId: string,
  edgeCost: (edge: Edge) => number
): { path: string[]; edges: Edge[]; totalCost: number } | null {
  if (!graph.nodes.has(startId) || !graph.nodes.has(endId)) return null;

  const distances = new Map<string, number>();
  const previous = new Map<string, Edge | null>(); // the edge we arrived by
  const unvisited = new Set<string>();

  graph.nodes.forEach((_, id) => {
    distances.set(id, Infinity);
    previous.set(id, null);
    unvisited.add(id);
  });
  distances.set(startId, 0);

  while (unvisited.size > 0) {
    // Pick the unvisited node with the smallest known distance
    let current: string | null = null;
    let smallest = Infinity;
    for (const id of unvisited) {
      const d = distances.get(id)!;
      if (d < smallest) {
        smallest = d;
        current = id;
      }
    }
    if (current === null) break; // remaining nodes are unreachable
    if (current === endId) break; // reached destination

    unvisited.delete(current);

    const outgoing = graph.adjacency.get(current) ?? [];
    for (const edge of outgoing) {
      if (!unvisited.has(edge.toNodeId)) continue;
      const cost = edgeCost(edge);
      if (cost === Infinity) continue; // this route type can't use this edge
      const candidate = distances.get(current)! + cost;
      if (candidate < distances.get(edge.toNodeId)!) {
        distances.set(edge.toNodeId, candidate);
        previous.set(edge.toNodeId, edge);
      }
    }
  }

  if (distances.get(endId) === Infinity) return null; // no path found

  // Walk back from endId to startId via the edges we arrived by
  const path = [endId];
  const edges: Edge[] = [];
  let edge = previous.get(endId);
  while (edge) {
    edges.unshift(edge);
    path.unshift(edge.fromNodeId);
    edge = previous.get(edge.fromNodeId);
  }

  return { path, edges, totalCost: distances.get(endId)! };
}
