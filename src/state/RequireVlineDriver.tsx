import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useSession } from './SessionProvider';

export default function RequireVlineDriver({ children }: { children: ReactNode }) {
  const { driver, loading } = useSession();

  if (loading) {
    return (
      <main className="flex min-h-full items-center justify-center text-slate-400">
        Loading…
      </main>
    );
  }

  if (!driver?.can_drive_vline) {
    return (
      <main className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-black">CDC V/Line</h1>
        <p className="text-slate-300">
          This screen is for V/Line-qualified drivers only. Ask an admin to enable V/Line on your driver
          profile if you need access.
        </p>
        <Link to="/routes" className="btn-secondary">
          ← Back to routes
        </Link>
      </main>
    );
  }

  return <>{children}</>;
}
