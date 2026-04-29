import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signOutDriver } from '../../lib/auth';
import { ROUTE_THEMES } from '../../lib/cdc/theme';
import type { RouteCode } from '../../lib/cdc/types';
import type { RouteRow } from '../../lib/db';
import { loadActiveRoutes, loadRoutePath } from '../../lib/routes';
import { useSession } from '../../state/SessionProvider';
import { useShiftSetup } from '../../state/ShiftSetupProvider';

// Weekend variants like C012-SAT/C012-SUN reuse the same stop sequence as the
// base C012 route. Map any V/Line route_number back to its base RouteCode so
// the manifest screen and downstream tally helpers see one of the two values
// they understand.
function baseCode(routeNumber: string): RouteCode {
  return routeNumber.toUpperCase().startsWith('C011') ? 'C011' : 'C012';
}

export default function CdcRoutePicker() {
  const navigate = useNavigate();
  const { driver } = useSession();
  const { setRoute } = useShiftSetup();
  const [routes, setRoutes] = useState<RouteRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'remote' | 'cache' | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadActiveRoutes(true).then((res) => {
      if (cancelled) return;
      setRoutes(res.rows.filter((r) => r.service_type === 'vline'));
      setSource(res.source);
      if (res.error) setError(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function pick(route: RouteRow) {
    // Set the route in ShiftSetupProvider so /bus and /run know which route is
    // being driven. Pre-fetch the path geojson so the map renders fast on /run.
    setRoute(route.id);
    void loadRoutePath(route.id);
    navigate(`/cdc/manifest?route=${baseCode(route.route_number)}`);
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col gap-4 p-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-3xl font-black">V/Line routes</h1>
          {driver && <p className="text-slate-400">{driver.full_name}</p>}
        </div>
        <div className="flex items-center gap-3">
          <Link to="/services" className="text-sm text-blue-400 underline-offset-4 hover:underline">
            ← Services
          </Link>
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
          <p>No active V/Line routes.</p>
          <p className="mt-2 text-sm text-slate-400">
            Ask an admin to add or activate a V/Line route in the admin panel.
          </p>
          {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {routes?.map((route) => {
          const code = baseCode(route.route_number);
          const theme = ROUTE_THEMES[code];
          return (
            <li key={route.id}>
              <button
                type="button"
                onClick={() => pick(route)}
                className={`min-h-touch w-full rounded-3xl px-5 py-5 text-left ${theme.solid}`}
              >
                <div className="text-2xl font-black">{route.route_number}</div>
                {route.description && (
                  <div className="text-sm font-semibold opacity-80">{route.description}</div>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
