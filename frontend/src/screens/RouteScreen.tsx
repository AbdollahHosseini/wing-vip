import { useState } from 'react';
import { useRoute } from '../hooks/useRoute';
import type { RouteProfile } from '../types/domain';

type Props = {
  buildingId: string;
  fromNodeId: string;
  toNodeId: string;
};

const PROFILES: { value: RouteProfile; label: string }[] = [
  { value: 'fastest', label: 'Fastest' },
  { value: 'stepFree', label: 'Step-free' },
  { value: 'avoidStairs', label: 'Avoid stairs' },
];

export function RouteScreen({ buildingId, fromNodeId, toNodeId }: Props) {
  const [profile, setProfile] = useState<RouteProfile>('fastest');
  const { route, isLoading, error } = useRoute(buildingId, fromNodeId, toNodeId, profile);

  return (
    <div>
      <h1>Your route</h1>
      <fieldset>
        <legend>Route type</legend>
        {PROFILES.map((p) => (
          <label key={p.value}>
            <input
              type="radio"
              name="profile"
              value={p.value}
              checked={profile === p.value}
              onChange={() => setProfile(p.value)}
            />
            {p.label}
          </label>
        ))}
      </fieldset>

      {isLoading && <p>Calculating route…</p>}
      {!isLoading && error && <p style={{ color: 'crimson' }}>{error}</p>}
      {!isLoading && !error && route && (
        <>
          {profile === 'stepFree' && route.unsurveyedConnections > 0 && (
            <p>
              {route.unsurveyedConnections === 1
                ? '1 connection on this route has'
                : `${route.unsurveyedConnections} connections on this route have`}{' '}
              not been checked for step-free access yet.
            </p>
          )}
          <ol>
            {route.steps.map((step, i) => <li key={i}>{step.instruction}</li>)}
          </ol>
          {/* A MapView component would render route.path over the map-gl-indoor
              2D floor view here, once the first real building is digitised. */}
          <p style={{ color: '#888' }}>
            {Math.round(route.totalDistanceMetres)}m, about{' '}
            {Math.max(1, Math.round(route.estimatedSeconds / 60))} min — {route.path.join(' → ')}
          </p>
        </>
      )}
    </div>
  );
}
