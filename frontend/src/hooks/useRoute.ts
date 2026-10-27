/**
 * The "controller" for the route screen. A classic backend controller
 * receives a request and decides what to do; here the "request" is a UI
 * event (a destination picked), and this hook plays that role: it calls
 * a service and turns the result into state a component can render.
 *
 * RouteScreen talks ONLY to this hook — never to RoutingService or any
 * repository directly.
 */
import { useEffect, useState } from 'react';
import { calculateRoute } from '../services/RoutingService';
import type { Route } from '../types/domain';

export function useRoute(buildingId: string, fromNodeId: string | null, toNodeId: string | null) {
  const [route, setRoute] = useState<Route | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fromNodeId || !toNodeId) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    calculateRoute(buildingId, fromNodeId, toNodeId)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setError('No route found between those two points.');
          return;
        }
        setRoute(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? 'Something went wrong calculating the route.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [buildingId, fromNodeId, toNodeId]);

  return { route, isLoading, error };
}
