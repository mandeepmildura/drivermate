import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listAllRoutes } from '../lib/adminRoutes';
import type { RouteRow } from '../lib/db';

export default function Admin() {
  const [routes, setRoutes] = useState<RouteRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    listAllRoutes()
      .then(setRoutes)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  return (
    <main className="mx-auto flex min-h-full max-w-3xl flex-col gap-4 p-6">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="self-start rounded-xl bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
      >
        ← Back to driver
      </button>
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black">Route admin</h1>
          <p className="text-slate-400">Edit routes here. Drivers see published routes read-only.</p>
        </div>
        <Link to="/admin/new" className="btn-primary w-auto px-5">
          + New route
        </Link>
      </header>

      {error && (
        <p className="rounded-2xl bg-red-500/15 p-3 text-sm text-red-200">{error}</p>
      )}
      {routes === null && !error && <p className="text-slate-400">Loading routes…</p>}
      {routes?.length === 0 && (
        <p className="rounded-2xl bg-slate-800 p-4 text-slate-300">
          No routes yet. Tap “New route” to add one.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {routes?.map((route) => (
          <li key={route.id}>
            <Link
              to={`/admin/${route.id}`}
              className="flex items-center justify-between rounded-2xl bg-slate-800 px-5 py-4 hover:bg-slate-700"
            >
              <div>
                <p className="text-2xl font-bold">{route.route_number}</p>
                <p className="text-sm text-slate-400">
                  {route.display_number ? `Bus display ${route.display_number}` : 'No display number'}
                  {route.description ? ` · ${route.description}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest">
                {!route.active && (
                  <span className="rounded-full bg-slate-700 px-3 py-1 text-slate-300">Inactive</span>
                )}
                <span
                  className={`rounded-full px-3 py-1 ${
                    route.locked
                      ? 'bg-amber-500/20 text-amber-200'
                      : 'bg-emerald-500/20 text-emerald-200'
                  }`}
                >
                  {route.locked ? 'Locked' : 'Editable'}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
