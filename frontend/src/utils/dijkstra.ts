/**
 * Pure function: no React, no database, no side effects — input in,
 * answer out. This is what lets a teammate test or swap the algorithm
 * (e.g. Dijkstra -> A*) without touching a single component.
 *
 * For a graph this size (a few hundred nodes at most) a plain O(V^2)
 * scan is more than fast enough — no need for a priority queue.
 */
import type { Graph } from '../types/domain';

export function findShortestPath(
  graph: Graph,
  startId: string,
  endId: string
): { path: string[]; totalDistanceMetres: number } | null {
  const distances = new Map<string, number>();
  const previous = new Map<string, string | null>();
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

    const neighbours = graph.adjacency.get(current) ?? [];
    for (const { neighbourId, weightMetres } of neighbours) {
      if (!unvisited.has(neighbourId)) continue;
      const candidate = distances.get(current)! + weightMetres;
      if (candidate < distances.get(neighbourId)!) {
        distances.set(neighbourId, candidate);
        previous.set(neighbourId, current);
      }
    }
  }

  if (distances.get(endId) === Infinity) return null; // no path found

  // Walk back from endId to startId via `previous`
  const path: string[] = [];
  let step: string | null = endId;
  while (step !== null) {
    path.unshift(step);
    step = previous.get(step)!;
  }

  return { path, totalDistanceMetres: distances.get(endId)! };
}
