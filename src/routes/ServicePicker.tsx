import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signOutDriver } from '../lib/auth';
import { useSession } from '../state/SessionProvider';

export default function ServicePicker() {
  const navigate = useNavigate();
  const { driver } = useSession();
  const canDriveVline = driver?.can_drive_vline ?? false;

  // School-only drivers don't see a fork — go straight to school routes.
  useEffect(() => {
    if (driver && !canDriveVline) navigate('/routes', { replace: true });
  }, [driver, canDriveVline, navigate]);

  if (!canDriveVline) return null;

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-outline-variant/40 bg-white/90 px-5 py-3 backdrop-blur-md">
        <div className="flex flex-col">
          <h1 className="text-lg font-black tracking-tight text-on-surface">DriverMate</h1>
          {driver && (
            <p className="text-xs text-on-surface-variant">{driver.full_name}</p>
          )}
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15">
          <SyncIcon className="h-5 w-5 text-primary" />
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 px-5 py-6">
        <div className="space-y-1.5">
          <h2 className="text-3xl font-black tracking-tight">Pick a service</h2>
          <p className="text-on-surface-variant">
            Select your assigned vehicle type to begin your route across Mildura.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            to="/routes"
            className="flex items-center gap-4 rounded-2xl border border-outline-variant/30 bg-white p-4 shadow-sm active:bg-surface-container"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/15">
              <SchoolIcon className="h-7 w-7 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold leading-tight text-on-surface">School Bus</p>
              <p className="text-sm text-on-surface-variant">Daily student transport routes</p>
            </div>
            <ChevronRightIcon className="h-5 w-5 shrink-0 text-on-surface-variant" />
          </Link>

          <Link
            to="/cdc/routes"
            className="flex items-center gap-4 rounded-2xl border border-outline-variant/30 bg-white p-4 shadow-sm active:bg-surface-container"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-secondary/15">
              <BusIcon className="h-7 w-7 text-secondary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold leading-tight text-on-surface">V/Line Coach</p>
              <p className="text-sm text-on-surface-variant">Regional long-distance services</p>
            </div>
            <ChevronRightIcon className="h-5 w-5 shrink-0 text-on-surface-variant" />
          </Link>
        </div>

        <div className="mx-auto flex items-center gap-2 rounded-full bg-surface-container px-5 py-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
          <span className="h-2 w-2 rounded-full bg-primary" />
          Ready to start
        </div>

        <div className="mt-auto flex items-center justify-center gap-3 pt-4 text-sm text-on-surface-variant">
          <Link to="/account/pin" className="underline-offset-4 hover:underline">
            Change PIN
          </Link>
          <span aria-hidden>·</span>
          <button
            type="button"
            onClick={() => signOutDriver()}
            className="underline-offset-4 hover:underline"
          >
            Sign out
          </button>
        </div>
      </div>
    </main>
  );
}

function SchoolIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 3 1 9l11 6 9-4.91V17h2V9L12 3zm-7 12c0 1.66 3.13 3 7 3s7-1.34 7-3v-3.27l-7 3.82-7-3.82V15z" />
    </svg>
  );
}

function BusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M4 16c0 .88.39 1.67 1 2.22V20a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h8v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM18 11H6V6h12v5z" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M9.29 6.71a1 1 0 0 0 0 1.41L13.17 12l-3.88 3.88a1 1 0 1 0 1.41 1.41l4.59-4.59a1 1 0 0 0 0-1.41L10.7 6.7a1 1 0 0 0-1.41 0z" />
    </svg>
  );
}

function SyncIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
    </svg>
  );
}
