/**
 * A pure function with no mocking needed — a good first test for anyone
 * new to testing on this team. Reproduces the path hand-verified during
 * planning: Room 1.01 -> Junction A -> Junction B -> Room 1.08, 24m.
 *
 * These tests cost each edge by its length in metres, so they check the
 * search itself; tests/routeCost.test.ts checks the route types.
 */
import { describe, expect, it } from 'vitest';
import { findShortestPath } from '../src/utils/dijkstra';
import { buildGraph } from '../src/utils/graph';
import { buildTestGraph, edge, floors, node } from './testGraph';

const byMetres = (e: { weightMetres: number }) => e.weightMetres;

describe('findShortestPath', () => {
  it('finds the shortest path through two junctions', () => {
    const graph = buildTestGraph();
    const result = findShortestPath(graph, '4W-1.01', '4W-1.08', byMetres);

    expect(result).not.toBeNull();
    expect(result!.path).toEqual(['4W-1.01', '4W-1-J1', '4W-1-J2', '4W-1.08']);
    expect(result!.edges.map((e) => [e.fromNodeId, e.toNodeId])).toEqual([
      ['4W-1.01', '4W-1-J1'],
      ['4W-1-J1', '4W-1-J2'],
      ['4W-1-J2', '4W-1.08'],
    ]);
    expect(result!.totalCost).toBe(24);
  });

  it('walks two-way edges in either direction', () => {
    const graph = buildTestGraph();
    const result = findShortestPath(graph, '4W-1.08', '4W-1.01', byMetres);

    expect(result!.path).toEqual(['4W-1.08', '4W-1-J2', '4W-1-J1', '4W-1.01']);
  });

  it('returns null when no path exists', () => {
    const graph = buildTestGraph();
    graph.nodes.set('island', node('island', '4W-1', 'room', 'Island', 100, 100));

    const result = findShortestPath(graph, '4W-1.01', 'island', byMetres);
    expect(result).toBeNull();
  });

  it('returns null for a node that is not in the graph', () => {
    const graph = buildTestGraph();
    expect(findShortestPath(graph, '4W-1.01', 'no-such-room', byMetres)).toBeNull();
  });

  it('never walks a one-way edge backwards', () => {
    const graph = buildGraph(
      floors,
      [node('a', '4W-1', 'room', 'A', 0, 0), node('b', '4W-1', 'room', 'B', 5, 0)],
      [edge('a', 'b', 5, { kind: 'door', oneWay: true })]
    );

    expect(findShortestPath(graph, 'a', 'b', byMetres)).not.toBeNull();
    expect(findShortestPath(graph, 'b', 'a', byMetres)).toBeNull();
  });

  it('skips edges that cost Infinity', () => {
    const graph = buildTestGraph();
    const noStairs = (e: { kind: string; weightMetres: number }) =>
      e.kind === 'stairs' ? Infinity : e.weightMetres;

    const result = findShortestPath(graph, '4W-1.01', '4W-2.05', noStairs);
    expect(result!.path).toContain('4W-1-LIFT');
  });
});
