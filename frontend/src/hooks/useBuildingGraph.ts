/**
 * Loads the raw graph for a building — used where a screen needs to list
 * nodes (e.g. populating a destination dropdown) rather than calculate a
 * route. Hooks are allowed to call repositories directly; this one
 * doesn't need a service in between because there's no orchestration
 * happening, just a fetch.
 */
import { useEffect, useState } from 'react';
import { fetchGraph } from '../repositories/graphRepository';
import type { Graph } from '../types/domain';

export function useBuildingGraph(buildingId: string) {
  const [graph, setGraph] = useState<Graph | null>(null);

  useEffect(() => {
    fetchGraph(buildingId).then(setGraph);
  }, [buildingId]);

  return graph;
}
