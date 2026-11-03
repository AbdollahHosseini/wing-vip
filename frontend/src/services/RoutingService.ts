/**
 * Orchestration: combines the graph, today's closures and three utils into
 * one meaningful operation — "calculate a route." This is the layer a
 * teammate touches to change what that operation means; what each route
 * type avoids or prefers lives in utils/routeCost.ts.
 *
 * Rule this layer exists to teach: if a "service" function would just
 * forward straight to a repository with nothing added, skip the service
 * and call the repository directly from the hook instead.
 */
import { fetchActiveClosures } from '../repositories/closureRepository';
import { getGraph } from './GraphService';
import { findShortestPath } from '../utils/dijkstra';
import { generateDirections } from '../utils/directions';
import { makeEdgeCost, travelSeconds } from '../utils/routeCost';
import type { Route, RouteProfile } from '../types/domain';

export async function calculateRoute(
  buildingId: string,
  fromNodeId: string,
  toNodeId: string,
  profile: RouteProfile = 'fastest'
): Promise<Route | null> {
  const [graph, closures] = await Promise.all([getGraph(buildingId), fetchActiveClosures()]);

  const result = findShortestPath(graph, fromNodeId, toNodeId, makeEdgeCost(profile, closures));
  if (!result) return null;

  const { path, edges } = result;
  return {
    path,
    edges,
    totalDistanceMetres: edges.reduce((sum, e) => sum + e.weightMetres, 0),
    // Real travel time, without the penalties used to choose the route
    estimatedSeconds: edges.reduce((sum, e) => sum + travelSeconds(e, profile), 0),
    unsurveyedConnections: edges.filter((e) => e.accessible === null).length,
    steps: generateDirections(graph, path, edges),
  };
}
