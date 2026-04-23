import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { useSession } from '../state/SessionProvider';
import { useShiftSetup } from '../state/ShiftSetupProvider';
import { flushPendingMutations } from '../lib/sync';

function formatDuration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return '—';
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const totalMin = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function EndOfRun() {
  const navigate = useNavigate();
  const { driver } = useSession();
  const { reset } = useShiftSetup();
  const [syncing, setSyncing] = useState(false);

  const lastShift = useLiveQuery(async () => {
    if (!driver) return undefined;
    const all = await db.shifts.where('driver_id').equals(driver.id).toArray();
    all.sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
    return all[0];
  }, [driver?.id]);

  const totalPickups = useLiveQuery(async () => {
    if (!lastShift) return 0;
    const events = await db.stop_events.where('shift_id').equals(lastShift.id).toArray();
    return events.reduce((s, e) => s + e.pickup_count, 0);
  }, [lastShift?.id]);

  const stopCount = useLiveQuery(async () => {
    if (!lastShift) return 0;
    const events = await db.stop_events.where('shift_id').equals(lastShift.id).toArray();
    if (events.length === 0) return 0;
    const rows = await db.route_stops.bulkGet(events.map((e) => e.route_stop_id));
    return rows.filter((r) => r?.kind === 'stop').length;
  }, [lastShift?.id]);

  const pendingCount = useLiveQuery(() => db.pending.count(), [], 0);

  useEffect(() => {
    flushPendingMutations().catch(() => {});
  }, []);

  async function syncNow() {
    setSyncing(true);
    await flushPendingMutations();
    setSyncing(false);
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col gap-4 p-6">
      <header>
        <h1 className="text-3xl font-black">Run complete</h1>
        {lastShift && (
          <p className="text-slate-400">
            {formatDuration(lastShift.started_at, lastShift.ended_at)} on the road
          </p>
        )}
      </header>

      <section className="rounded-3xl bg-slate-800 p-5">
        <dl className="grid grid-cols-2 gap-y-3 text-lg">
          <dt className="text-slate-400">Children carried</dt>
          <dd className="text-right text-3xl font-black">{totalPickups ?? 0}</dd>
          <dt className="text-slate-400">Stops logged</dt>
          <dd className="text-right text-3xl font-black">{stopCount ?? 0}</dd>
        </dl>
      </section>

      <section className="rounded-3xl bg-slate-800 p-5">
        <p className="text-xs uppercase tracking-widest text-slate-400">Sync status</p>
        {pendingCount === 0 ? (
          <p className="mt-1 text-emerald-300">All shift data synced to the depot.</p>
        ) : (
          <>
            <p className="mt-1 text-amber-200">
              {pendingCount} change{pendingCount === 1 ? '' : 's'} waiting to upload.
            </p>
            <button type="button" onClick={syncNow} className="btn-primary mt-3" disabled={syncing}>
              {syncing ? 'Syncing…' : 'Try sync now'}
            </button>
          </>
        )}
      </section>

      <button
        type="button"
        onClick={() => {
          reset();
          navigate('/routes');
        }}
        className="btn-primary"
      >
        Start another run
      </button>
    </main>
  );
}
