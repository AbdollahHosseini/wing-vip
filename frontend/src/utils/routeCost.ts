/**
 * Pure functions: what an edge costs for a given route type. No React, no
 * database. Dijkstra minimises this cost, so this file is where "step-free"
 * or "avoid stairs" is actually decided — the algorithm itself never
 * changes.
 *
 * Cost is in seconds, not metres, so lifts compare fairly with corridors: a
 * lift ride has no walking distance but still takes its ride and wait time
 * (the edge's extraSeconds). Infinity means "this route type can't use this
 * edge at all".
 *
 * Step-free limits follow UK Approved Document M: doors need at least 775 mm
 * of clear width in existing buildings, and nothing steeper than a 1:12
 * ramp. The penalties below are starting guesses — tune them with real
 * users.
 */
import type { Closure, Edge, RouteProfile } from '../types/domain';

const WALKING_SPEED_M_PER_S = 1.2;
const STEP_FREE_SPEED_M_PER_S = 1.0;

const MIN_DOOR_WIDTH_M = 0.775;
const MAX_RAMP_SLOPE_PCT = 100 / 12; // 1:12
const GENTLE_SLOPE_PCT = 5; // 1:20 — steeper than this is tiring, so it costs extra

const STAIRS_PENALTY_S = 120; // "avoid stairs": take the stairs only to save 2+ minutes
const STEEP_SLOPE_PENALTY_S = 30;
const MANUAL_DOOR_PENALTY_S = 10;
// Nobody has checked this edge yet. Step-free routes may still use it, but
// prefer surveyed ones, and the route screen warns about each one used.
const UNSURVEYED_PENALTY_S = 60;

/** Realistic travel time for an edge, with no penalties. */
export function travelSeconds(edge: Edge, profile: RouteProfile): number {
  const speed = profile === 'stepFree' ? STEP_FREE_SPEED_M_PER_S : WALKING_SPEED_M_PER_S;
  return edge.weightMetres / speed + edge.extraSeconds;
}

/**
 * Builds the cost function Dijkstra uses for one route calculation. Closures
 * block an edge for every route type; closing a node (e.g. a lift) blocks
 * every edge into or out of it.
 */
export function makeEdgeCost(profile: RouteProfile, closures: Closure[]): (edge: Edge) => number {
  const closedNodes = new Set(closures.map((c) => c.nodeId).filter((id) => id !== null));
  const closedEdges = new Set(closures.map((c) => c.edgeId).filter((id) => id !== null));

  return (edge) => {
    if (closedEdges.has(edge.id)) return Infinity;
    if (closedNodes.has(edge.fromNodeId) || closedNodes.has(edge.toNodeId)) return Infinity;
    return travelSeconds(edge, profile) + penalty(edge, profile);
  };
}

function penalty(edge: Edge, profile: RouteProfile): number {
  if (profile === 'stepFree') return stepFreePenalty(edge);
  if (profile === 'avoidStairs') return avoidStairsPenalty(edge);
  return 0;
}

function stepFreePenalty(edge: Edge): number {
  if (edge.kind === 'stairs' || edge.accessible === false) return Infinity;
  if (edge.stepCount !== null && edge.stepCount > 0) return Infinity;
  if (edge.doorWidthMetres !== null && edge.doorWidthMetres < MIN_DOOR_WIDTH_M) return Infinity;

  // Steep is a problem both ways: hard to push up, hard to control going down.
  const slope = Math.abs(edge.slopePct ?? 0);
  if (slope > MAX_RAMP_SLOPE_PCT) return Infinity;

  let total = 0;
  if (slope > GENTLE_SLOPE_PCT) total += STEEP_SLOPE_PENALTY_S;
  if (edge.kind === 'door' && edge.automaticDoor !== true) total += MANUAL_DOOR_PENALTY_S;
  if (edge.accessible === null) total += UNSURVEYED_PENALTY_S;
  return total;
}

function avoidStairsPenalty(edge: Edge): number {
  if (edge.kind === 'stairs') return STAIRS_PENALTY_S;
  if (Math.abs(edge.slopePct ?? 0) > MAX_RAMP_SLOPE_PCT) return STEEP_SLOPE_PENALTY_S;
  return 0;
}
