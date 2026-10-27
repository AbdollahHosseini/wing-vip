import { createClient } from '@supabase/supabase-js';

// Safe to expose in frontend code — the anon key only grants what Row
// Level Security policies allow (read-only on nodes/edges/qr_codes).
// Every other repository imports this one shared client.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
