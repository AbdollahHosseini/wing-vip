/**
 * A pure function with no mocking needed — a good first test for anyone
 * new to testing on this team. Reproduces the path hand-verified during
 * planning: Room 1.01 -> Junction A -> Junction B -> Room 1.08, 24m.
 */
import { describe, expect, it } from 'vitest';
import { findShortestPath } from '../src/utils/dijkstra';
import type { Graph } from '../src/types/domain';

function buildTestGraph(): Graph {
  const nodes: Graph['nodes'] = new Map([
    ['4W-1.01', { id: '4W-1.01', floorId: '4W-1', kind: 'room', label: 'Room 1.01', x: 0, y: 0, lng: null, lat: null }],
    ['4W-1-J1', { id: '4W-1-J1', floorId: '4W-1', kind: 'junction', label: 'Junction A', x: 8, y: 0, lng: null, lat: null }],
    ['4W-1-J2', { id: '4W-1-J2', floorId: '4W-1', kind: 'junction', label: 'Junction B', x: 16, y: 0, lng: null, lat: null }],
    ['4W-1.08', { id: '4W-1.08', floorId: '4W-1', kind: 'room', label: 'Room 1.08', x: 24, y: 0, lng: null, lat: null }],
    ['4W-1-LIFT', { id: '4W-1-LIFT', floorId: '4W-1', kind: 'lift', label: 'Lift 1', x: 16, y: 6, lng: null, lat: null }],
  ]);

  const adjacency: Graph['adjacency'] = new Map();
  const addEdge = (a: string, b: string, weightMetres: number) => {
    if (!adjacency.has(a)) adjacency.set(a, []);
    adjacency.get(a)!.push({ neighbourId: b, weightMetres });
  };
  const pairs: [string, string, number][] = [
    ['4W-1.01', '4W-1-J1', 8],
    ['4W-1-J1', '4W-1-J2', 8],
    ['4W-1-J2', '4W-1.08', 8],
    ['4W-1-J2', '4W-1-LIFT', 6],
  ];
  pairs.forEach(([a, b, w]) => {
    addEdge(a, b, w);
    addEdge(b, a, w);
  });

  return { nodes, adjacency };
}

describe('findShortestPath', () => {
  it('finds the shortest path through two junctions', () => {
    const graph = buildTestGraph();
    const result = findShortestPath(graph, '4W-1.01', '4W-1.08');

    expect(result).not.toBeNull();
    expect(result!.path).toEqual(['4W-1.01', '4W-1-J1', '4W-1-J2', '4W-1.08']);
    expect(result!.totalDistanceMetres).toBe(24);
  });

  it('returns null when no path exists', () => {
    const graph = buildTestGraph();
    graph.nodes.set('island', { id: 'island', floorId: '4W-1', kind: 'room', label: 'Island', x: 100, y: 100, lng: null, lat: null });

    const result = findShortestPath(graph, '4W-1.01', 'island');
    expect(result).toBeNull();
  });
});
