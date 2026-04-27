import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export type Client = SupabaseClient<Database>;

let client: Client | null = null;

export function getSupabase(): Client {
  if (!url || !anonKey) {
    throw new Error(
      'Supabase credentials missing. Copy .env.local.example to .env.local and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    );
  }
  if (!client) {
    client = createClient<Database>(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}

export const isSupabaseConfigured = Boolean(url && anonKey);
