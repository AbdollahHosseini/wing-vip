/**
 * Orchestration: building data from the repository + buildGraph from utils
 * = a routable graph. Cached in memory per building, because the graph is
 * small (a few hundred nodes) and doesn't change while someone is
 * navigating. The promise is cached, not the result, so the search screen
 * and the route screen asking at the same moment share one fetch.
 */
import { fetchBuildingData } from '../repositories/graphRepository';
import { buildGraph } from '../utils/graph';
import type { Graph } from '../types/domain';

const cache = new Map<string, Promise<Graph>>();

export function getGraph(buildingId: string): Promise<Graph> {
  let graph = cache.get(buildingId);
  if (!graph) {
    graph = fetchBuildingData(buildingId).then(({ floors, nodes, edges }) =>
      buildGraph(floors, nodes, edges)
    );
    // A failed fetch shouldn't stick: let the next call try again.
    graph.catch(() => cache.delete(buildingId));
    cache.set(buildingId, graph);
  }
  return graph;
}
