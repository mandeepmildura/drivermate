import { db, type DriverRow } from './db';
import { getSupabase } from './supabase';

export interface DriverDraft {
  driver_number: string;
  full_name: string;
  is_admin: boolean;
  active: boolean;
  can_drive_vline: boolean;
}

export async function listAllDrivers(): Promise<DriverRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('drivers')
    .select('id, driver_number, full_name, is_admin, active, can_drive_vline')
    .order('driver_number');
  if (error) throw error;
  const rows = (data ?? []) as DriverRow[];
  if (rows.length > 0) await db.drivers.bulkPut(rows);
  return rows;
}

export async function createDriver(draft: DriverDraft): Promise<DriverRow> {
  const supabase = getSupabase();
  // auth_user_id stays null — set when the driver self-registers and links a
  // Supabase auth account to this row.
  const { data, error } = await supabase
    .from('drivers')
    .insert({
      driver_number: draft.driver_number.trim(),
      full_name: draft.full_name.trim(),
      is_admin: draft.is_admin,
      active: draft.active,
      can_drive_vline: draft.can_drive_vline,
    })
    .select('id, driver_number, full_name, is_admin, active, can_drive_vline')
    .single();
  if (error) throw error;
  const row = data as DriverRow;
  await db.drivers.put(row);
  return row;
}

export async function adminResetDriverPin(
  driverId: string,
  newPin: string,
): Promise<void> {
  if (!/^\d{6,12}$/.test(newPin)) {
    throw new Error('PIN must be 6–12 digits.');
  }
  const supabase = getSupabase();
  const { error } = await supabase.rpc('admin_reset_driver_pin', {
    p_driver_id: driverId,
    p_new_pin: newPin,
  });
  if (error) throw error;
}

export async function updateDriverFlags(
  driverId: string,
  patch: Partial<Pick<DriverRow, 'active' | 'can_drive_vline' | 'is_admin' | 'full_name'>>,
): Promise<DriverRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('drivers')
    .update(patch)
    .eq('id', driverId)
    .select('id, driver_number, full_name, is_admin, active, can_drive_vline')
    .single();
  if (error) throw error;
  const row = data as DriverRow;
  await db.drivers.put(row);
  return row;
}
