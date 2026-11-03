import { describe, expect, it } from 'vitest';
import { findShortestPath } from '../src/utils/dijkstra';
import { generateDirections } from '../src/utils/directions';
import { buildGraph } from '../src/utils/graph';
import { makeEdgeCost } from '../src/utils/routeCost';
import type { Floor } from '../src/types/domain';
import { buildTestGraph, edge, node } from './testGraph';

function directions(from: string, to: string, graph = buildTestGraph(), profile: 'fastest' | 'stepFree' = 'fastest') {
  const result = findShortestPath(graph, from, to, makeEdgeCost(profile, []))!;
  return generateDirections(graph, result.path, result.edges).map((s) => s.instruction);
}

describe('generateDirections', () => {
  it('names the floor the lift goes to, using the sign label', () => {
    const steps = directions('4W-1.01', '4W-2.05', buildTestGraph(), 'stepFree');

    expect(steps).toContain('Go to Lift 1.');
    expect(steps).toContain('Take Lift 1 to Level 2.');
  });

  it('says which way the stairs go', () => {
    expect(directions('4W-1.01', '4W-2.05')).toContain('Take the stairs up to Level 2.');
    expect(directions('4W-2.05', '4W-1.01')).toContain('Take the stairs down to Level 1.');
  });

  it('describes a lift ride over several floors once', () => {
    const floors: Floor[] = [1, 2, 3].map((level) => ({
      id: `F${level}`, buildingId: 'B', level, label: `Level ${level}`,
    }));
    const graph = buildGraph(
      floors,
      [
        node('L1', 'F1', 'lift', 'Lift A', 0, 0),
        node('L2', 'F2', 'lift', 'Lift A', 0, 0),
        node('L3', 'F3', 'lift', 'Lift A', 0, 0),
        node('R3', 'F3', 'room', 'Room 3.10', 5, 0),
      ],
      [
        edge('L1', 'L2', 0, { kind: 'lift', extraSeconds: 20 }),
        edge('L2', 'L3', 0, { kind: 'lift', extraSeconds: 20 }),
        edge('L3', 'R3', 5),
      ]
    );

    const steps = directions('L1', 'R3', graph);
    expect(steps.filter((s) => s.startsWith('Take Lift A'))).toEqual(['Take Lift A to Level 3.']);
  });

  it('describes ramps and doors in the direction walked', () => {
    const graph = buildGraph(
      [{ id: 'F1', buildingId: 'B', level: 1, label: 'Level 1' }],
      [node('a', 'F1', 'junction', 'A', 0, 0), node('b', 'F1', 'room', 'Room 1.20', 10, 0)],
      [edge('a', 'b', 10, { kind: 'ramp', slopePct: 5 })]
    );

    expect(directions('a', 'b', graph)).toContain('Go up the ramp.');
    expect(directions('b', 'a', graph)).toContain('Go down the ramp.');
    expect(directions('a', 'b', graph)).toContain('You have arrived at Room 1.20.');
  });
});
