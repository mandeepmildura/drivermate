import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  adminResetDriverPin,
  createDriver,
  listAllDrivers,
  updateDriverFlags,
  type DriverDraft,
} from '../lib/adminDrivers';
import type { DriverRow } from '../lib/db';

const blankDraft: DriverDraft = {
  driver_number: '',
  full_name: '',
  is_admin: false,
  active: true,
  can_drive_vline: false,
};

export default function AdminDrivers() {
  const navigate = useNavigate();
  const [drivers, setDrivers] = useState<DriverRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<DriverDraft>(blankDraft);
  const [saving, setSaving] = useState(false);
  const [resettingFor, setResettingFor] = useState<string | null>(null);
  const [resetPin, setResetPin] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);

  function refresh() {
    listAllDrivers()
      .then(setDrivers)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function add() {
    setError(null);
    setInfo(null);
    if (!draft.driver_number.trim() || !draft.full_name.trim()) {
      setError('Driver number and full name are required.');
      return;
    }
    setSaving(true);
    try {
      await createDriver(draft);
      setInfo(`Created driver ${draft.driver_number}. They can now register a PIN.`);
      setDraft(blankDraft);
      setAdding(false);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(driver: DriverRow, patch: Partial<DriverRow>) {
    setError(null);
    try {
      await updateDriverFlags(driver.id, patch);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function startReset(driverId: string) {
    setError(null);
    setInfo(null);
    setResettingFor(driverId);
    setResetPin('');
  }

  function cancelReset() {
    setResettingFor(null);
    setResetPin('');
  }

  async function submitReset(driver: DriverRow) {
    setError(null);
    setInfo(null);
    if (!/^\d{6,12}$/.test(resetPin)) {
      setError('PIN must be 6–12 digits.');
      return;
    }
    setResetSubmitting(true);
    try {
      await adminResetDriverPin(driver.id, resetPin);
      setInfo(`Reset PIN for ${driver.driver_number}. Tell the driver their new PIN in person.`);
      setResettingFor(null);
      setResetPin('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setResetSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-full max-w-3xl flex-col gap-4 p-6">
      <button
        type="button"
        onClick={() => navigate('/admin')}
        className="self-start rounded-xl bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
      >
        ← Back to admin
      </button>
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black">Drivers &amp; managers</h1>
          <p className="text-slate-400">
            Add a driver, mark depot managers, and reset PINs.
          </p>
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => { setAdding(true); setError(null); setInfo(null); }}
            className="btn-primary w-auto px-5"
          >
            + New profile
          </button>
        )}
      </header>

      {error && <p className="rounded-2xl bg-red-500/15 p-3 text-sm text-red-200">{error}</p>}
      {info && <p className="rounded-2xl bg-emerald-500/15 p-3 text-sm text-emerald-200">{info}</p>}

      {adding && (
        <div className="rounded-2xl bg-slate-800 p-5 flex flex-col gap-3">
          <h2 className="text-lg font-bold">New profile</h2>
          <p className="text-xs text-slate-400">
            A depot manager is a driver profile with the manager flag on. They can edit
            routes and reset other drivers&rsquo; PINs.
          </p>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-slate-400">Driver number</span>
            <input
              type="text"
              value={draft.driver_number}
              onChange={(e) => setDraft({ ...draft, driver_number: e.target.value })}
              placeholder="e.g. 105"
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-slate-400">Full name</span>
            <input
              type="text"
              value={draft.full_name}
              onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
              placeholder="e.g. Mandeep Gill"
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={draft.can_drive_vline}
              onChange={(e) => setDraft({ ...draft, can_drive_vline: e.target.checked })}
              className="h-4 w-4"
            />
            Can drive V/Line coach routes
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={draft.is_admin}
              onChange={(e) => setDraft({ ...draft, is_admin: e.target.checked })}
              className="h-4 w-4"
            />
            Depot manager (can edit routes and reset PINs)
          </label>
          <p className="text-xs text-slate-500">
            The driver sets their own numeric PIN when they register on the app.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={add}
              disabled={saving}
              className="rounded-full bg-blue-500 px-5 py-2 text-sm font-bold text-white active:bg-blue-400 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Create driver'}
            </button>
            <button
              type="button"
              onClick={() => { setAdding(false); setDraft(blankDraft); }}
              className="rounded-full bg-slate-700 px-5 py-2 text-sm text-slate-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {drivers === null && !error && <p className="text-slate-400">Loading drivers…</p>}
      {drivers?.length === 0 && (
        <p className="rounded-2xl bg-slate-800 p-4 text-slate-300">No drivers yet.</p>
      )}

      <ul className="flex flex-col gap-2">
        {drivers?.map((d) => (
          <li
            key={d.id}
            className="rounded-2xl bg-slate-800 px-5 py-4 flex flex-col gap-3"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-2xl font-bold">{d.driver_number}</p>
                <p className="text-sm text-slate-400">
                  {d.full_name}
                  {d.is_admin && <span className="ml-2 text-amber-300">· depot manager</span>}
                  {!d.active && <span className="ml-2 text-red-300">· inactive</span>}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => toggle(d, { is_admin: !d.is_admin })}
                  className={`rounded-full px-3 py-1.5 font-bold ${
                    d.is_admin
                      ? 'bg-amber-500/20 text-amber-200'
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  Manager: {d.is_admin ? 'yes' : 'no'}
                </button>
                <button
                  type="button"
                  onClick={() => toggle(d, { can_drive_vline: !d.can_drive_vline })}
                  className={`rounded-full px-3 py-1.5 font-bold ${
                    d.can_drive_vline
                      ? 'bg-emerald-500/20 text-emerald-200'
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  V/Line: {d.can_drive_vline ? 'allowed' : 'blocked'}
                </button>
                <button
                  type="button"
                  onClick={() => toggle(d, { active: !d.active })}
                  className={`rounded-full px-3 py-1.5 font-bold ${
                    d.active
                      ? 'bg-emerald-500/20 text-emerald-200'
                      : 'bg-red-500/20 text-red-200'
                  }`}
                >
                  {d.active ? 'Active' : 'Inactive'}
                </button>
                <button
                  type="button"
                  onClick={() => startReset(d.id)}
                  className="rounded-full bg-blue-500/20 px-3 py-1.5 font-bold text-blue-200 hover:bg-blue-500/30"
                >
                  Reset PIN
                </button>
              </div>
            </div>
            {resettingFor === d.id && (
              <div className="rounded-xl bg-slate-900 p-4 flex flex-col gap-3">
                <p className="text-xs text-slate-400">
                  Choose a temporary 6–12 digit PIN for {d.full_name}. Tell them in
                  person — they can change it themselves from the driver menu.
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={resetPin}
                  onChange={(e) => setResetPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="New PIN"
                  className="rounded-lg bg-slate-800 px-3 py-2 text-lg tracking-[0.4em]"
                  minLength={6}
                  maxLength={12}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => submitReset(d)}
                    disabled={resetSubmitting}
                    className="rounded-full bg-blue-500 px-5 py-2 text-sm font-bold text-white active:bg-blue-400 disabled:opacity-50"
                  >
                    {resetSubmitting ? 'Resetting…' : 'Set PIN'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelReset}
                    className="rounded-full bg-slate-700 px-5 py-2 text-sm text-slate-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
