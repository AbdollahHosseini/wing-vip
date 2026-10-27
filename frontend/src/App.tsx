import { useState } from 'react';
import { ScanScreen } from './screens/ScanScreen';
import { SearchScreen } from './screens/SearchScreen';
import { RouteScreen } from './screens/RouteScreen';

const BUILDING_ID = '4W'; // hardcoded until multi-building selection exists

type Stage =
  | { name: 'scan' }
  | { name: 'search'; currentNodeId: string }
  | { name: 'route'; currentNodeId: string; destinationNodeId: string };

export default function App() {
  const [stage, setStage] = useState<Stage>({ name: 'scan' });

  if (stage.name === 'scan') {
    return (
      <ScanScreen
        onLocated={(nodeId) => setStage({ name: 'search', currentNodeId: nodeId })}
      />
    );
  }

  if (stage.name === 'search') {
    return (
      <SearchScreen
        buildingId={BUILDING_ID}
        currentNodeId={stage.currentNodeId}
        onDestinationChosen={(destinationNodeId) =>
          setStage({ name: 'route', currentNodeId: stage.currentNodeId, destinationNodeId })
        }
      />
    );
  }

  return (
    <RouteScreen
      buildingId={BUILDING_ID}
      fromNodeId={stage.currentNodeId}
      toNodeId={stage.destinationNodeId}
    />
  );
}
