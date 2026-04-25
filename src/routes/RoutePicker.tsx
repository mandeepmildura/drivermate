import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loadActiveRoutes, loadRoutePath } from '../lib/routes';
import { useShiftSetup } from '../state/ShiftSetupProvider';
import { useSession } from '../state/SessionProvider';
import { signOutDriver } from '../lib/auth';
import type { RouteRow } from '../lib/db';

export default function RoutePicker() {
  const navigate = useNavigate();
  const { driver } = useSession();
  const { setRoute } = useShiftSetup();
  const [routes, setRoutes] = useState<RouteRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'remote' | 'cache' | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadActiveRoutes().then((res) => {
      if (cancelled) return;
      setRoutes(res.rows);
      setSource(res.source);
      if (res.error) setError(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function pick(routeId: string) {
    setRoute(routeId);
    void loadRoutePath(routeId); // fire-and-forget — populates path_geojson before /run renders
    navigate('/bus');
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col gap-4 p-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-3xl font-black">Today&rsquo;s routes</h1>
          {driver && <p className="text-slate-400">{driver.full_name}</p>}
        </div>
        <div className="flex items-center gap-3">
          {driver?.is_admin && (
            <Link to="/admin" className="text-sm text-blue-400 underline-offset-4 hover:underline">
              Admin
            </Link>
          )}
          <button
            type="button"
            onClick={() => signOutDriver()}
            className="text-sm text-slate-400 underline-offset-4 hover:underline"
          >
            Sign out
          </button>
        </div>
      </header>

      {source === 'cache' && (
        <div className="rounded-2xl bg-amber-500/10 p-3 text-sm text-amber-200">
          Showing cached routes — couldn&rsquo;t reach the depot.
        </div>
      )}

      {routes === null && <p className="text-slate-400">Loading routes…</p>}
      {routes !== null && routes.length === 0 && (
        <div className="rounded-2xl bg-slate-800 p-4 text-slate-300">
          <p>No active routes for your depot.</p>
          <p className="mt-2 text-sm text-slate-400">
            Ask an admin to add or activate a route in the admin panel.
          </p>
          {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {routes?.map((route) => (
          <li key={route.id}>
            <button type="button" onClick={() => pick(route.id)} className="btn-primary text-left">
              <div className="flex items-baseline justify-between">
                <span>{route.route_number}</span>
                {route.display_number && (
                  <span className="text-base font-semibold opacity-70">
                    Bus display: {route.display_number}
                  </span>
                )}
              </div>
              {route.description && (
                <span className="block text-base font-medium opacity-80">{route.description}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
