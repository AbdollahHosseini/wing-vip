/**
 * Pure function: path of node IDs -> English instructions. No React, no
 * database. This is the "generating clear, human-readable directions
 * from graph output" research question, in its simplest working form.
 *
 * Lifts, stairs, ramps and doors are described from the edge taken;
 * everything else from the node reached.
 */
import type { Edge, Graph, Node, RouteStep } from '../types/domain';

export function generateDirections(graph: Graph, path: string[], edges: Edge[]): RouteStep[] {
  const nodes = path.map((id) => graph.nodes.get(id)!) as Node[];
  const steps: RouteStep[] = [];

  steps.push({ instruction: `Start at ${nodes[0].label}.` });

  for (let i = 1; i < nodes.length; i++) {
    const prev = nodes[i - 1];
    const curr = nodes[i];
    const edge = edges[i - 1];
    const isLast = i === nodes.length - 1;

    // A lift ride or stair climb over several floors is several edges in a
    // row: describe it once, at the floor where you get off.
    if (!isLast && changesFloor(edge) && edges[i].kind === edge.kind) continue;

    const edgeInstruction = describeEdge(graph, prev, curr, edge);
    if (edgeInstruction) {
      steps.push({ instruction: edgeInstruction });
      if (isLast) steps.push({ instruction: `You have arrived at ${curr.label}.` });
      continue;
    }

    if (curr.kind === 'lift') {
      steps.push({ instruction: `Go to ${curr.label}.` });
      continue;
    }
    if (curr.kind === 'junction') {
      steps.push({ instruction: `Continue ${bearingLabel(prev, curr)} to the next junction.` });
      continue;
    }
    if (isLast) {
      steps.push({ instruction: `Continue ${bearingLabel(prev, curr)}. ${curr.label} is on your route.` });
    }
  }

  return steps;
}

function changesFloor(edge: Edge): boolean {
  return edge.kind === 'lift' || edge.kind === 'stairs';
}

function describeEdge(graph: Graph, from: Node, to: Node, edge: Edge): string | null {
  switch (edge.kind) {
    case 'lift':
      return `Take ${to.label} to ${floorLabel(graph, to)}.`;
    case 'stairs': {
      const climb = levelOf(graph, to) - levelOf(graph, from);
      if (climb === 0) return edge.stepCount ? `Take the ${edge.stepCount} steps.` : 'Take the steps.';
      return `Take the stairs ${climb > 0 ? 'up' : 'down'} to ${floorLabel(graph, to)}.`;
    }
    case 'ramp':
      if (edge.slopePct === null || edge.slopePct === 0) return 'Follow the ramp.';
      return `Go ${edge.slopePct > 0 ? 'up' : 'down'} the ramp.`;
    case 'door':
      return edge.automaticDoor ? 'Go through the automatic door.' : 'Go through the door.';
    default:
      return null;
  }
}

function levelOf(graph: Graph, node: Node): number {
  return graph.floors.get(node.floorId ?? '')?.level ?? 0;
}

function floorLabel(graph: Graph, node: Node): string {
  return graph.floors.get(node.floorId ?? '')?.label ?? 'the next floor';
}

function bearingLabel(from: Node, to: Node): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'straight ahead' : 'back the way you came';
  return dy > 0 ? 'left' : 'right';
}
