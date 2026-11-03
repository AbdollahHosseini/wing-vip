/**
 * Shared test data: the seed.sql floor plus a second floor, so routes can
 * choose between stairs and a lift.
 *
 *   Level 1:  [1.01]---(J1)---(J2)---[1.08]
 *                       |      |
 *                    stairs  [lift]
 *                       |      |
 *   Level 2:  [2.05]---(J1)---(J2)
 *
 * The stairs are short (4 m) but have 20 steps; the lift adds 30 s of
 * ride and wait. So the fastest route upstairs takes the stairs, and
 * step-free or avoid-stairs routes take the lift.
 */
import { buildGraph } from '../src/utils/graph';
import type { Edge, Floor, Graph, Node, NodeKind } from '../src/types/domain';

let nextEdgeId = 1;

export function node(id: string, floorId: string, kind: NodeKind, label: string, x: number, y: number): Node {
  return { id, floorId, kind, label, x, y, lng: null, lat: null };
}

/** A surveyed, step-free, two-way corridor unless `overrides` says otherwise. */
export function edge(fromNodeId: string, toNodeId: string, weightMetres: number, overrides: Partial<Edge> = {}): Edge {
  return {
    id: nextEdgeId++,
    fromNodeId,
    toNodeId,
    kind: 'corridor',
    weightMetres,
    extraSeconds: 0,
    oneWay: false,
    accessible: true,
    stepCount: null,
    doorWidthMetres: null,
    automaticDoor: null,
    slopePct: null,
    ...overrides,
  };
}

export const floors: Floor[] = [
  { id: '4W-1', buildingId: '4W', level: 1, label: 'Level 1' },
  { id: '4W-2', buildingId: '4W', level: 2, label: 'Level 2' },
];

export function buildTestGraph(): Graph {
  const nodes = [
    node('4W-1.01', '4W-1', 'room', 'Room 1.01', 0, 0),
    node('4W-1-J1', '4W-1', 'junction', 'Junction A', 8, 0),
    node('4W-1-J2', '4W-1', 'junction', 'Junction B', 16, 0),
    node('4W-1.08', '4W-1', 'room', 'Room 1.08', 24, 0),
    node('4W-1-LIFT', '4W-1', 'lift', 'Lift 1', 16, 6),
    node('4W-2-LIFT', '4W-2', 'lift', 'Lift 1', 16, 6),
    node('4W-2-J2', '4W-2', 'junction', 'Junction D', 16, 0),
    node('4W-2-J1', '4W-2', 'junction', 'Junction C', 8, 0),
    node('4W-2.05', '4W-2', 'room', 'Room 2.05', 0, 0),
  ];

  const edges = [
    edge('4W-1.01', '4W-1-J1', 8),
    edge('4W-1-J1', '4W-1-J2', 8),
    edge('4W-1-J2', '4W-1.08', 8),
    edge('4W-1-J2', '4W-1-LIFT', 6),
    edge('4W-1-J1', '4W-2-J1', 4, { kind: 'stairs', accessible: false, stepCount: 20 }),
    edge('4W-1-LIFT', '4W-2-LIFT', 0, { kind: 'lift', extraSeconds: 30 }),
    edge('4W-2-LIFT', '4W-2-J2', 6),
    edge('4W-2-J2', '4W-2-J1', 8),
    edge('4W-2-J1', '4W-2.05', 8),
  ];

  return buildGraph(floors, nodes, edges);
}
