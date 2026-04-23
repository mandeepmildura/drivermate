import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useSession } from './SessionProvider';

export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { driver, loading } = useSession();

  if (loading) {
    return (
      <main className="flex min-h-full items-center justify-center text-slate-400">
        Loading…
      </main>
    );
  }

  if (!driver?.is_admin) {
    return <Navigate to="/routes" replace />;
  }

  return <>{children}</>;
}
