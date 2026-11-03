/**
 * Lifts out of service and locked doors that apply right now. Deliberately
 * NOT cached: a closure can start or end while someone is mid-journey, so
 * every route calculation asks again.
 */
import { supabase } from './supabaseClient';
import type { Closure } from '../types/domain';

export async function fetchActiveClosures(): Promise<Closure[]> {
  const { data, error } = await supabase
    .from('active_closures')
    .select('node_id, edge_id, reason');
  if (error) throw error;

  return data.map((row) => ({
    nodeId: row.node_id,
    edgeId: row.edge_id,
    reason: row.reason,
  }));
}
