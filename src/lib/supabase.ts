import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Until we generate Database types, use `any` for the schema generic.
// The runtime client is configured to talk to the `drivermate` Postgres schema.
export type Client = SupabaseClient<any, 'drivermate', 'drivermate'>;

let client: Client | null = null;

export function getSupabase(): Client {
  if (!url || !anonKey) {
    throw new Error(
      'Supabase credentials missing. Copy .env.local.example to .env.local and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    );
  }
  if (!client) {
    client = createClient<any, 'drivermate', 'drivermate'>(url, anonKey, {
      db: { schema: 'drivermate' },
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}

export const isSupabaseConfigured = Boolean(url && anonKey);
