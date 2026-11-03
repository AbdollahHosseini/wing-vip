/**
 * The shape of our data — nothing else lives in this file. No logic, no
 * imports from anywhere else in the app. This is the first file a new
 * teammate should read: it's the vocabulary for every conversation about
 * what WING actually models.
 */

export type NodeKind = 'room' | 'junction' | 'stairs' | 'lift' | 'exit';

export type EdgeKind = 'corridor' | 'door' | 'stairs' | 'ramp' | 'lift' | 'outdoor';

/** What the user asked the route to optimise for. See utils/routeCost.ts. */
export type RouteProfile = 'fastest' | 'stepFree' | 'avoidStairs';

export interface Building {
  id: string; // e.g. '4W'
  name: string; // e.g. '4 West'
}

export interface Floor {
  id: string; // e.g. '4W-1'
  buildingId: string;
  level: number; // 0 = ground, 1 = first floor, ... matches map-gl-indoor's `level` tag
  label: string; // as on the building's signs, e.g. "Level 1" — what directions read out
}

export interface Node {
  id: string; // e.g. '4W-1.01'
  floorId: string | null; // null for outdoor nodes
  kind: NodeKind;
  label: string; // human-readable, e.g. "Room 1.01"
  x: number; // local floor-plan coordinates (metres) — used for routing distance
  y: number;
  lng: number | null; // map coordinates from the nodes_geo view — used only for map rendering
  lat: number | null;
}

export interface Edge {
  id: number;
  fromNodeId: string;
  toNodeId: string;
  kind: EdgeKind;
  weightMetres: number; // walking length; 0 for a lift ride
  extraSeconds: number; // time on top of walking, e.g. a lift's ride and wait
  oneWay: boolean; // true = usable only fromNodeId -> toNodeId
  accessible: boolean | null; // true = surveyed step-free, false = not step-free, null = not surveyed
  stepCount: number | null;
  doorWidthMetres: number | null;
  automaticDoor: boolean | null;
  slopePct: number | null; // signed in the fromNodeId -> toNodeId direction: positive = uphill
}

/** A lift out of service or a locked door. Exactly one of nodeId / edgeId is set. */
export interface Closure {
  nodeId: string | null;
  edgeId: number | null;
  reason: string;
}

export interface QrMapping {
  code: string; // the literal string encoded in the physical QR sticker
  nodeId: string;
}

/** The whole routable graph for one building, as an adjacency list. */
export interface Graph {
  nodes: Map<string, Node>;
  floors: Map<string, Floor>;
  // Edges leaving each node, already pointing the way you'd walk them: a
  // two-way edge is listed under both of its ends, a one-way edge only
  // under its fromNodeId.
  adjacency: Map<string, Edge[]>;
}

export interface RouteStep {
  instruction: string; // e.g. "Continue straight ahead to the next junction."
}

export interface Route {
  path: string[]; // ordered node IDs from start to destination
  edges: Edge[]; // edges[i] joins path[i] to path[i + 1]
  totalDistanceMetres: number;
  estimatedSeconds: number;
  unsurveyedConnections: number; // edges on the route nobody has checked for step-free access
  steps: RouteStep[];
}
