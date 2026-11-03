/**
 * The route types end to end: the same building, the same search, and only
 * the cost function changes.
 */
import { describe, expect, it } from 'vitest';
import { findShortestPath } from '../src/utils/dijkstra';
import { makeEdgeCost } from '../src/utils/routeCost';
import type { Closure, RouteProfile } from '../src/types/domain';
import { buildTestGraph, edge } from './testGraph';

function routeUpstairs(profile: RouteProfile, closures: Closure[] = []) {
  return findShortestPath(buildTestGraph(), '4W-1.01', '4W-2.05', makeEdgeCost(profile, closures));
}

const liftClosed: Closure = { nodeId: '4W-1-LIFT', edgeId: null, reason: 'Out of service' };

describe('route types', () => {
  it('fastest takes the stairs', () => {
    expect(routeUpstairs('fastest')!.path).toEqual(['4W-1.01', '4W-1-J1', '4W-2-J1', '4W-2.05']);
  });

  it('step-free takes the lift', () => {
    expect(routeUpstairs('stepFree')!.path).toContain('4W-1-LIFT');
  });

  it('avoid-stairs takes the lift when the stairs save under 2 minutes', () => {
    expect(routeUpstairs('avoidStairs')!.path).toContain('4W-1-LIFT');
  });

  it('a closed lift leaves no step-free route', () => {
    expect(routeUpstairs('stepFree', [liftClosed])).toBeNull();
  });

  it('a closed lift sends avoid-stairs up the stairs instead of failing', () => {
    expect(routeUpstairs('avoidStairs', [liftClosed])!.path).toEqual(['4W-1.01', '4W-1-J1', '4W-2-J1', '4W-2.05']);
  });

  it('a closed edge is blocked for every route type', () => {
    const graph = buildTestGraph();
    const stairs = graph.adjacency.get('4W-1-J1')!.find((e) => e.kind === 'stairs')!;
    const closures: Closure[] = [{ nodeId: null, edgeId: stairs.id, reason: 'Cleaning' }];

    const result = findShortestPath(graph, '4W-1.01', '4W-2.05', makeEdgeCost('fastest', closures));
    expect(result!.path).toContain('4W-1-LIFT');
  });
});

describe('step-free rules', () => {
  const cost = makeEdgeCost('stepFree', []);

  it('blocks steps, narrow doors and slopes steeper than 1:12', () => {
    expect(cost(edge('a', 'b', 5, { stepCount: 1 }))).toBe(Infinity);
    expect(cost(edge('a', 'b', 1, { kind: 'door', doorWidthMetres: 0.7 }))).toBe(Infinity);
    expect(cost(edge('a', 'b', 10, { kind: 'ramp', slopePct: 10 }))).toBe(Infinity);
    expect(cost(edge('a', 'b', 10, { kind: 'ramp', slopePct: -10 }))).toBe(Infinity);
  });

  it('allows a 1:12 ramp and a wide door', () => {
    expect(cost(edge('a', 'b', 10, { kind: 'ramp', slopePct: 8.3 }))).toBeLessThan(Infinity);
    expect(cost(edge('a', 'b', 1, { kind: 'door', doorWidthMetres: 0.8 }))).toBeLessThan(Infinity);
  });

  it('prefers surveyed edges and automatic doors', () => {
    expect(cost(edge('a', 'b', 5, { accessible: null }))).toBeGreaterThan(cost(edge('a', 'b', 5)));
    expect(cost(edge('a', 'b', 1, { kind: 'door', automaticDoor: false }))).toBeGreaterThan(
      cost(edge('a', 'b', 1, { kind: 'door', automaticDoor: true }))
    );
  });
});
