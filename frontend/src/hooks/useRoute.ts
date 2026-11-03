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
import type { Route, RouteProfile } from '../types/domain';

export function useRoute(
  buildingId: string,
  fromNodeId: string | null,
  toNodeId: string | null,
  profile: RouteProfile
) {
  const [route, setRoute] = useState<Route | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fromNodeId || !toNodeId) return;

    let cancelled = false;
    // Show "Calculating route…" while the request below runs. This costs one
    // extra render per new request; deriving isLoading during render instead
    // would remove it, but would change how this hook works.
    // oxlint-disable-next-line react/set-state-in-effect
    setIsLoading(true);
    setError(null);

    calculateRoute(buildingId, fromNodeId, toNodeId, profile)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setError(
            profile === 'fastest'
              ? 'No route found between those two points.'
              : 'No route of this type right now — a lift may be out of service. Try another route type.'
          );
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
  }, [buildingId, fromNodeId, toNodeId, profile]);

  return { route, isLoading, error };
}
