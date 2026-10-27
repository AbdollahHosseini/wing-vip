/**
 * Pure function: path of node IDs -> English instructions. No React, no
 * database. This is the "generating clear, human-readable directions
 * from graph output" research question, in its simplest working form.
 */
import type { Graph, Node, RouteStep } from '../types/domain';

export function generateDirections(graph: Graph, path: string[]): RouteStep[] {
  const nodes = path.map((id) => graph.nodes.get(id)!) as Node[];
  const steps: RouteStep[] = [];

  steps.push({ instruction: `Start at ${nodes[0].label}.` });

  for (let i = 1; i < nodes.length; i++) {
    const prev = nodes[i - 1];
    const curr = nodes[i];
    const isLast = i === nodes.length - 1;

    if (curr.kind === 'lift') {
      steps.push({ instruction: `Take the lift (${curr.label}).` });
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

function bearingLabel(from: Node, to: Node): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'straight ahead' : 'back the way you came';
  return dy > 0 ? 'left' : 'right';
}
