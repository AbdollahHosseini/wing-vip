import { useRoute } from '../hooks/useRoute';

type Props = {
  buildingId: string;
  fromNodeId: string;
  toNodeId: string;
};

export function RouteScreen({ buildingId, fromNodeId, toNodeId }: Props) {
  const { route, isLoading, error } = useRoute(buildingId, fromNodeId, toNodeId);

  if (isLoading) return <p>Calculating route…</p>;
  if (error) return <p style={{ color: 'crimson' }}>{error}</p>;
  if (!route) return null;

  return (
    <div>
      <h1>Your route</h1>
      <ol>
        {route.steps.map((step, i) => <li key={i}>{step.instruction}</li>)}
      </ol>
      {/* A MapView component would render route.path over the map-gl-indoor
          2D floor view here, once the first real building is digitised. */}
      <p style={{ color: '#888' }}>
        {route.totalDistanceMetres}m — {route.path.join(' → ')}
      </p>
    </div>
  );
}
