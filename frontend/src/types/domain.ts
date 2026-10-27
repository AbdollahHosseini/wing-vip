/**
 * The shape of our data — nothing else lives in this file. No logic, no
 * imports from anywhere else in the app. This is the first file a new
 * teammate should read: it's the vocabulary for every conversation about
 * what WING actually models.
 */

export type NodeKind = 'room' | 'junction' | 'stairs' | 'lift' | 'exit';

export interface Building {
  id: string; // e.g. '4W'
  name: string; // e.g. '4 West'
}

export interface Floor {
  id: string; // e.g. '4W-1'
  buildingId: string;
  level: number; // 0 = ground, 1 = first floor, ... matches map-gl-indoor's `level` tag
}

export interface Node {
  id: string; // e.g. '4W-1.01'
  floorId: string;
  kind: NodeKind;
  label: string; // human-readable, e.g. "Room 1.01"
  x: number; // local floor-plan coordinates (metres) — used for routing distance
  y: number;
  lng: number | null; // real-world coordinates — used only for map rendering
  lat: number | null;
}

export interface Edge {
  fromNodeId: string;
  toNodeId: string;
  weightMetres: number; // used directly as the Dijkstra edge cost
  accessible: boolean; // false for step-only shortcuts
}

export interface QrMapping {
  code: string; // the literal string encoded in the physical QR sticker
  nodeId: string;
}

/** The whole routable graph for one building, as an adjacency list. */
export interface Graph {
  nodes: Map<string, Node>;
  adjacency: Map<string, { neighbourId: string; weightMetres: number }[]>;
}

export interface RouteStep {
  instruction: string; // e.g. "Continue straight ahead to the next junction."
}

export interface Route {
  path: string[]; // ordered node IDs from start to destination
  totalDistanceMetres: number;
  steps: RouteStep[];
}
