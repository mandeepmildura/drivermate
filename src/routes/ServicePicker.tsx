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
    <main className="mx-auto flex min-h-full max-w-md flex-col gap-6 p-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-3xl font-black">Pick a service</h1>
          {driver && <p className="text-on-surface-variant">{driver.full_name}</p>}
        </div>
        <div className="flex items-center gap-3">
          <Link to="/account/pin" className="text-sm text-on-surface-variant underline-offset-4 hover:underline">
            Change PIN
          </Link>
          <button
            type="button"
            onClick={() => signOutDriver()}
            className="text-sm text-on-surface-variant underline-offset-4 hover:underline"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-3">
        <Link
          to="/routes"
          className="min-h-touch rounded-3xl bg-primary px-5 py-6 text-on-primary active:bg-primary-container"
        >
          <div className="text-2xl font-black">School</div>
          <div className="text-sm font-semibold opacity-80">CDC Mildura school bus runs</div>
        </Link>
        <Link
          to="/cdc/routes"
          className="min-h-touch rounded-3xl bg-secondary px-5 py-6 text-on-primary active:bg-secondary-container"
        >
          <div className="text-2xl font-black">V/Line</div>
          <div className="text-sm font-semibold opacity-80">Mildura ↔ Bendigo coach</div>
        </Link>
      </div>
    </main>
  );
}
