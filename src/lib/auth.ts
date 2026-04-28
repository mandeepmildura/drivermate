import type { AuthError } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import { db, type DriverRow } from './db';

// Drivers don't have real email addresses — we synthesise one from the
// depot driver number so we can use Supabase auth without giving every
// driver a personal email account. The PIN they type is the password.
// Supabase auth's email validator rejects reserved TLDs like `.local`,
// so use a real public TLD even though nothing is ever delivered here.
const DRIVER_EMAIL_DOMAIN = 'drivermate.app';

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

export interface SignUpResult {
  ok: boolean;
  error?: string;
}

export async function registerDriver(
  driverNumber: string,
  pin: string,
): Promise<SignUpResult> {
  const trimmedNumber = driverNumber.trim();
  if (!trimmedNumber) return { ok: false, error: 'Driver number is required.' };
  if (!/^\d{6,12}$/.test(pin)) {
    return { ok: false, error: 'PIN must be 6–12 digits.' };
  }

  const supabase = getSupabase();
  const email = driverNumberToEmail(trimmedNumber);

  // Step 1: create auth user. If email confirmation is on, this returns no
  // session; we still proceed and try to link, since RLS only needs auth.uid().
  const signUp = await supabase.auth.signUp({ email, password: pin });
  if (signUp.error) {
    if (signUp.error.message.toLowerCase().includes('already')) {
      return { ok: false, error: 'This driver number already has a PIN. Sign in instead.' };
    }
    return { ok: false, error: signUp.error.message };
  }

  // Step 2: signUp does not always return an active session. Sign in
  // explicitly so the next call has auth.uid() available.
  const signIn = await supabase.auth.signInWithPassword({ email, password: pin });
  if (signIn.error) return { ok: false, error: humanise(signIn.error) };

  // Step 3: claim the pre-created drivers row by driver_number.
  const { error: linkErr } = await supabase.rpc('register_driver', {
    p_driver_number: trimmedNumber,
  });
  if (linkErr) {
    // Roll back the auth session so the user isn't stranded with no driver row.
    await supabase.auth.signOut();
    return { ok: false, error: linkErr.message };
  }

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
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) return { driver: null, error: userErr.message };
  const userId = userData.user?.id;
  if (!userId) return { driver: null, error: 'Not signed in.' };

  // Filter by auth_user_id explicitly. RLS lets admins see every driver row,
  // so without this filter `.maybeSingle()` would error on admin sign-in with
  // "JSON object requested, multiple (or no) rows returned".
  const { data, error } = await supabase
    .from('drivers')
    .select('id, driver_number, full_name, is_admin, active, can_drive_vline')
    .eq('auth_user_id', userId)
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
    can_drive_vline: data.can_drive_vline ?? false,
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
