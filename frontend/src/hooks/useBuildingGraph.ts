/**
 * Loads the graph for a building — used where a screen needs to list
 * nodes (e.g. populating a destination dropdown) rather than calculate a
 * route. It goes through GraphService because turning rows into a graph
 * (and caching it) is orchestration, not just a fetch.
 */
import { useEffect, useState } from 'react';
import { getGraph } from '../services/GraphService';
import type { Graph } from '../types/domain';

export function useBuildingGraph(buildingId: string) {
  const [graph, setGraph] = useState<Graph | null>(null);

  useEffect(() => {
    getGraph(buildingId).then(setGraph);
  }, [buildingId]);

  return graph;
}
