import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { loadActiveBuses } from '../lib/routes';
import { useSession } from '../state/SessionProvider';
import { useShiftSetup } from '../state/ShiftSetupProvider';
import { recordShift } from '../lib/sync';
import { db, type BusRow, type ShiftRow } from '../lib/db';

function newId(): string {
  return crypto.randomUUID();
}

export default function BusConfirm() {
  const navigate = useNavigate();
  const { driver } = useSession();
  const { routeId, busId, busCodeOverride, setBus, setShift } = useShiftSetup();
  const [buses, setBuses] = useState<BusRow[] | null>(null);
  const [override, setOverride] = useState(busCodeOverride ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Look up the chosen route so the header back-link points to the picker
  // the driver actually came from (school /routes vs V/Line /cdc/routes).
  const routeRow = useLiveQuery(
    () => (routeId ? db.routes.get(routeId) : undefined),
    [routeId],
  );
  const routesBackTarget =
    routeRow?.service_type === 'vline' ? '/cdc/routes' : '/routes';
  const routesBackLabel =
    routeRow?.service_type === 'vline' ? '← V/Line routes' : '← Routes';

  useEffect(() => {
    if (!routeId) {
      navigate('/routes', { replace: true });
      return;
    }
    loadActiveBuses().then((res) => setBuses(res.rows));
  }, [routeId, navigate]);

  async function startShift() {
    if (!driver || !routeId) return;
    if (!busId && !override.trim()) {
      setError('Pick a bus or type a bus code.');
      return;
    }

    setError(null);
    setSubmitting(true);

    const now = new Date().toISOString();
    const shift: ShiftRow = {
      id: newId(),
      driver_id: driver.id,
      route_id: routeId,
      bus_id: busId,
      bus_code_override: busId ? null : override.trim() || null,
      started_at: now,
      ended_at: null,
      client_created_at: now,
      synced_at: null,
    };

    try {
      await recordShift(shift);
      setShift(shift.id);
      navigate('/run');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start shift.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col gap-4 p-6">
      <header className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-black">Which bus today?</h1>
          <p className="text-on-surface-variant">
            Pick the bus you&rsquo;re actually driving (not the route&rsquo;s usual bus).
          </p>
        </div>
        <Link
          to={routesBackTarget}
          className="shrink-0 text-sm text-secondary underline-offset-4 hover:underline"
        >
          {routesBackLabel}
        </Link>
      </header>

      {buses === null ? (
        <p className="text-on-surface-variant">Loading buses…</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {buses.map((bus) => {
            const selected = bus.id === busId;
            return (
              <li key={bus.id}>
                <button
                  type="button"
                  onClick={() => {
                    setBus(bus.id, null);
                    setOverride('');
                  }}
                  className={`min-h-touch w-full rounded-2xl px-4 py-4 text-2xl font-bold ${
                    selected
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container text-on-surface active:bg-surface-container-high'
                  }`}
                >
                  {bus.bus_code}
                  {bus.rego && (
                    <span className="ml-2 text-sm font-normal opacity-70">{bus.rego}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <label className="mt-2 flex flex-col gap-2">
        <span className="text-sm uppercase tracking-widest text-on-surface-variant">Other bus code</span>
        <input
          type="text"
          value={override}
          onChange={(e) => {
            setOverride(e.target.value);
            setBus(null, e.target.value);
          }}
          placeholder="e.g. M99"
          className="min-h-touch rounded-2xl bg-surface px-4 py-3 text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </label>

      {error && (
        <p className="rounded-xl bg-red-500/15 p-3 text-sm text-red-800">{error}</p>
      )}

      <button type="button" onClick={startShift} className="btn-primary mt-4" disabled={submitting}>
        {submitting ? 'Starting shift…' : 'Start shift'}
      </button>
    </main>
  );
}
