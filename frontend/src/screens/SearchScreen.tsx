import { useBuildingGraph } from '../hooks/useBuildingGraph';

type Props = {
  buildingId: string;
  currentNodeId: string;
  onDestinationChosen: (nodeId: string) => void;
};

export function SearchScreen({ buildingId, currentNodeId, onDestinationChosen }: Props) {
  const graph = useBuildingGraph(buildingId);

  if (!graph) return <p>Loading building data…</p>;

  const currentLabel = graph.nodes.get(currentNodeId)?.label ?? currentNodeId;
  const rooms = [...graph.nodes.values()].filter(
    (n) => n.kind === 'room' && n.id !== currentNodeId
  );

  return (
    <div>
      <h1>You are at: {currentLabel}</h1>
      <label>Where do you want to go?</label>
      <select onChange={(e) => onDestinationChosen(e.target.value)} defaultValue="">
        <option value="" disabled>Choose a destination…</option>
        {rooms.map((n) => (
          <option key={n.id} value={n.id}>{n.label}</option>
        ))}
      </select>
    </div>
  );
}
