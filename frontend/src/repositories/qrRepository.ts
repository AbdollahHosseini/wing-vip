/**
 * Resolves a scanned QR string to a node ID. The indirection (a code
 * table instead of baking a node ID straight into the QR image) means a
 * physical sticker can be reprinted or relocated without ever touching
 * the routing graph.
 */
import { supabase } from './supabaseClient';

export async function resolveCode(code: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('qr_codes')
    .select('node_id')
    .eq('code', code)
    .single();

  if (error || !data) return null;
  return data.node_id;
}
