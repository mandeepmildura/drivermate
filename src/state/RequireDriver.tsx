import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useSession } from './SessionProvider';

export default function RequireDriver({ children }: { children: ReactNode }) {
  const { session, driver, loading } = useSession();
  const location = useLocation();

  if (loading) {
    return (
      <main className="flex min-h-full items-center justify-center text-slate-400">
        Loading…
      </main>
    );
  }

  if (!session || !driver) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
