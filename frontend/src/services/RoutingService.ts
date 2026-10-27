/**
 * Orchestration: combines a repository + two utils into one meaningful
 * operation — "calculate a route." This is the layer a teammate touches
 * to change what that operation means (e.g. preferring lifts over
 * stairs for accessibility routing would be a change here, not in the
 * algorithm or the UI).
 *
 * Rule this layer exists to teach: if a "service" function would just
 * forward straight to a repository with nothing added, skip the service
 * and call the repository directly from the hook instead.
 */
import { fetchGraph } from '../repositories/graphRepository';
import { findShortestPath } from '../utils/dijkstra';
import { generateDirections } from '../utils/directions';
import type { Route } from '../types/domain';

export async function calculateRoute(
  buildingId: string,
  fromNodeId: string,
  toNodeId: string
): Promise<Route | null> {
  const graph = await fetchGraph(buildingId);
  const result = findShortestPath(graph, fromNodeId, toNodeId);
  if (!result) return null;

  const steps = generateDirections(graph, result.path);
  return {
    path: result.path,
    totalDistanceMetres: result.totalDistanceMetres,
    steps,
  };
}
