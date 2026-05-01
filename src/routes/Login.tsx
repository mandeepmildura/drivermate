import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInDriver } from '../lib/auth';
import { isSimEnabled } from '../lib/simFlag';
import { useSession } from '../state/SessionProvider';

// Pulls the Supabase project reference out of the anon key's JWT body.
// Used purely by the ?sim=1 diagnostic on the login page to verify that
// the URL and the anon key belong to the same project — Cloudflare Pages
// can silently truncate a long-pasted env var, leaving you with a
// correct-looking URL but a key that decodes to a different `ref`.
function decodeJwtRef(jwt: string): string {
  try {
    const payload = jwt.split('.')[1];
    if (!payload) return '(malformed)';
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const parsed = JSON.parse(json) as { ref?: string };
    return parsed.ref ?? '(no ref)';
  } catch {
    return '(decode failed)';
  }
}

export default function Login() {
  const navigate = useNavigate();
  const { session, driver, configured, profileError } = useSession();
  const [driverNumber, setDriverNumber] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (session && driver) navigate('/services', { replace: true });
  }, [session, driver, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await signInDriver(driverNumber, pin);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? 'Sign in failed.');
      setPin('');
    }
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 p-6">
      <header className="text-center">
        <h1 className="text-4xl font-black tracking-tight">DriverMate</h1>
        <p className="mt-2 text-slate-400">CDC Mildura</p>
      </header>

      {!configured && (
        <div className="rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-200">
          Supabase isn&rsquo;t configured. Set <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> in <code>.env.local</code>, then restart the dev server.
        </div>
      )}

      {/* Diagnostic strip: appears whenever the sim flag is on. Lets us
          verify on-device that the bundle is wired to the expected
          Supabase project. The anon key is public (RLS-protected), so
          surfacing its project ref isn't a credential leak. */}
      {isSimEnabled() && (
        <div className="rounded-2xl bg-slate-700/60 p-3 text-[11px] font-mono text-slate-300 break-all">
          URL: {String(import.meta.env.VITE_SUPABASE_URL ?? '(not set)')}
          <br />
          Anon key length: {String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').length} chars
          <br />
          Anon key project ref: {decodeJwtRef(String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-3xl bg-slate-800 p-6 shadow-xl">
        <label className="flex flex-col gap-2">
          <span className="text-sm uppercase tracking-widest text-slate-400">Driver number</span>
          <input
            type="text"
            inputMode="text"
            autoComplete="username"
            value={driverNumber}
            onChange={(e) => setDriverNumber(e.target.value)}
            className="min-h-touch rounded-2xl bg-slate-900 px-4 py-3 text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500"
            disabled={submitting || !configured}
            required
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm uppercase tracking-widest text-slate-400">PIN</span>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="min-h-touch rounded-2xl bg-slate-900 px-4 py-3 text-2xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            disabled={submitting || !configured}
            required
          />
        </label>

        {error && (
          <p className="rounded-xl bg-red-500/15 p-3 text-sm text-red-200">{error}</p>
        )}
        {profileError && !error && (
          <p className="rounded-xl bg-amber-500/15 p-3 text-sm text-amber-200">{profileError}</p>
        )}

        <button type="submit" className="btn-primary" disabled={submitting || !configured}>
          {submitting ? 'Signing in…' : 'Start shift'}
        </button>
      </form>

      <p className="text-center text-sm text-slate-400">
        First time?{' '}
        <Link to="/register" className="text-emerald-300 underline-offset-4 hover:underline">
          Set up your PIN
        </Link>
      </p>
      <p className="text-center text-xs text-slate-500">
        Forgot your PIN? Speak to the depot supervisor.
      </p>
    </main>
  );
}
