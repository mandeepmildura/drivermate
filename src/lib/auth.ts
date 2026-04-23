import type { AuthError } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import { db, type DriverRow } from './db';

// Drivers don't have real email addresses — we synthesise one from the
// depot driver number so we can use Supabase auth without giving every
// driver a personal email account. The PIN they type is the password.
const DRIVER_EMAIL_DOMAIN = 'drivermate.local';

export function driverNumberToEmail(driverNumber: string): string {
  return `${driverNumber.trim().toLowerCase()}@${DRIVER_EMAIL_DOMAIN}`;
}

export interface SignInResult {
  ok: boolean;
  error?: string;
}

export async function signInDriver(driverNumber: string, pin: string): Promise<SignInResult> {
  if (!driverNumber.trim() || !pin.trim()) {
    return { ok: false, error: 'Driver number and PIN are required.' };
  }
  const supabase = getSupabase();
  const { error } = await supabase.auth.signInWithPassword({
    email: driverNumberToEmail(driverNumber),
    password: pin,
  });
  if (error) return { ok: false, error: humanise(error) };
  return { ok: true };
}

export async function signOutDriver(): Promise<void> {
  const supabase = getSupabase();
  await supabase.auth.signOut();
  // Wipe locally cached driver-scoped data so the next driver on this tablet
  // starts clean. Routes/buses/route_stops are shared and stay cached.
  await db.transaction('rw', db.drivers, db.shifts, db.stop_events, db.pending, async () => {
    await db.drivers.clear();
    await db.shifts.clear();
    await db.stop_events.clear();
    await db.pending.clear();
  });
}

export interface ProfileResult {
  driver: DriverRow | null;
  error: string | null;
}

export async function loadDriverProfile(): Promise<ProfileResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('drivers')
    .select('id, driver_number, full_name, is_admin, active')
    .maybeSingle();
  if (error) {
    console.error('[drivermate] loadDriverProfile failed:', error);
    return { driver: null, error: error.message };
  }
  if (!data) {
    return {
      driver: null,
      error: 'Signed in OK, but no DriverMate driver row is linked to this account. Contact your admin.',
    };
  }
  const row: DriverRow = {
    id: data.id,
    driver_number: data.driver_number,
    full_name: data.full_name,
    is_admin: data.is_admin,
    active: data.active,
  };
  await db.drivers.put(row);
  return { driver: row, error: null };
}

function humanise(error: AuthError): string {
  if (error.message.toLowerCase().includes('invalid')) {
    return 'Driver number or PIN is incorrect.';
  }
  return error.message;
}
