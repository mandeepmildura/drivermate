import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerDriver } from '../lib/auth';
import { useSession } from '../state/SessionProvider';

export default function Register() {
  const navigate = useNavigate();
  const { session, driver, configured, refreshProfile } = useSession();
  const [driverNumber, setDriverNumber] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (session && driver) navigate('/routes', { replace: true });
  }, [session, driver, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (pin !== confirmPin) {
      setError('PINs do not match.');
      return;
    }
    setSubmitting(true);
    const result = await registerDriver(driverNumber, pin);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? 'Registration failed.');
      setPin('');
      setConfirmPin('');
      return;
    }
    // SessionProvider already cached "no driver row" before the RPC linked
    // the row. Force a re-fetch so the redirect-on-driver effect can fire.
    await refreshProfile();
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 p-6">
      <header className="text-center">
        <h1 className="text-4xl font-black tracking-tight">Set up PIN</h1>
        <p className="mt-2 text-on-surface-variant">First-time registration</p>
      </header>

      {!configured && (
        <div className="rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-800">
          Supabase isn&rsquo;t configured.
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-3xl bg-surface-container p-6 shadow-xl">
        <p className="text-sm text-on-surface-variant">
          Your driver number must already be added by the depot manager.
          Choose a numeric PIN you&rsquo;ll remember — you can change it from the
          driver menu once you&rsquo;re signed in.
        </p>

        <label className="flex flex-col gap-2">
          <span className="text-sm uppercase tracking-widest text-on-surface-variant">Driver number</span>
          <input
            type="text"
            inputMode="text"
            autoComplete="username"
            value={driverNumber}
            onChange={(e) => setDriverNumber(e.target.value)}
            className="min-h-touch rounded-2xl bg-surface px-4 py-3 text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={submitting || !configured}
            required
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm uppercase tracking-widest text-on-surface-variant">Choose PIN (6–12 digits)</span>
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="new-password"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            className="min-h-touch rounded-2xl bg-surface px-4 py-3 text-2xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={submitting || !configured}
            minLength={6}
            maxLength={12}
            required
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm uppercase tracking-widest text-on-surface-variant">Confirm PIN</span>
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="new-password"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
            className="min-h-touch rounded-2xl bg-surface px-4 py-3 text-2xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={submitting || !configured}
            minLength={6}
            maxLength={12}
            required
          />
        </label>

        {error && <p className="rounded-xl bg-red-500/15 p-3 text-sm text-red-800">{error}</p>}

        <button type="submit" className="btn-primary" disabled={submitting || !configured}>
          {submitting ? 'Registering…' : 'Set PIN'}
        </button>
      </form>

      <p className="text-center text-sm text-on-surface-variant">
        Already have a PIN?{' '}
        <Link to="/login" className="text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
