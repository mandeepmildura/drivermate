import { useState } from 'react';
import { useSyncHealth } from '../lib/useSyncHealth';

/**
 * Surfaces sync queue problems to the driver. Renders nothing when sync is
 * healthy. Once any mutation has been retried 3+ times, shows a red bar with
 * a tap-to-expand details panel — the driver knows immediately something
 * isn't reaching the server, instead of silently accumulating in IndexedDB.
 */
export function SyncHealthBanner() {
  const health = useSyncHealth();
  const [open, setOpen] = useState(false);

  const hasProblem = health.failing > 0 || health.paused > 0;
  if (!hasProblem) return null;

  const stuckCount = health.failing + health.paused;
  const cls = health.paused > 0 ? 'bg-red-600' : 'bg-amber-500';
  const headline =
    health.paused > 0
      ? `Sync stopped — ${health.paused} item${health.paused === 1 ? '' : 's'} can't be uploaded`
      : `Sync slow — ${stuckCount} item${stuckCount === 1 ? '' : 's'} retrying`;

  return (
    <div
      className={`shrink-0 ${cls} text-white text-sm font-semibold cursor-pointer select-none border-b border-black/20`}
      onClick={() => setOpen((o) => !o)}
    >
      <div className="flex items-center justify-between px-4 py-2">
        <span>⚠ {headline}</span>
        <span className="text-xs opacity-80">{open ? 'Hide' : 'Details'}</span>
      </div>
      {open && (
        <div className="px-4 pb-3 text-xs leading-relaxed bg-black/20">
          <p>Pending: {health.pending} · Failing: {health.failing} · Paused: {health.paused}</p>
          {health.lastError && (
            <p className="mt-1 font-mono break-all">
              Last error ({health.lastErrorEntity}): {health.lastError}
            </p>
          )}
          <p className="mt-2 opacity-90">
            Your shift data is still saved on this tablet. Tell your depot — they may need to
            check the server.
          </p>
        </div>
      )}
    </div>
  );
}
