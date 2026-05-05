import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { changePin } from '../lib/auth';
import { useSession } from '../state/SessionProvider';

export default function ChangePin() {
  const navigate = useNavigate();
  const { driver } = useSession();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (newPin !== confirmPin) {
      setError('New PINs do not match.');
      return;
    }
    setSubmitting(true);
    const result = await changePin(currentPin, newPin);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? 'Could not change PIN.');
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      return;
    }
    setInfo('PIN updated. Use your new PIN next sign in.');
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col gap-6 p-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="self-start rounded-xl bg-surface-container px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-high"
      >
        ← Back
      </button>

      <header>
        <h1 className="text-3xl font-black">Change PIN</h1>
        {driver && <p className="text-on-surface-variant">{driver.full_name} · {driver.driver_number}</p>}
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-3xl bg-surface-container p-6 shadow-xl">
        <label className="flex flex-col gap-2">
          <span className="text-sm uppercase tracking-widest text-on-surface-variant">Current PIN</span>
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="current-password"
            value={currentPin}
            onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
            className="min-h-touch rounded-2xl bg-surface px-4 py-3 text-2xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={submitting}
            minLength={6}
            maxLength={12}
            required
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm uppercase tracking-widest text-on-surface-variant">New PIN (6–12 digits)</span>
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="new-password"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
            className="min-h-touch rounded-2xl bg-surface px-4 py-3 text-2xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={submitting}
            minLength={6}
            maxLength={12}
            required
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm uppercase tracking-widest text-on-surface-variant">Confirm new PIN</span>
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="new-password"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
            className="min-h-touch rounded-2xl bg-surface px-4 py-3 text-2xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={submitting}
            minLength={6}
            maxLength={12}
            required
          />
        </label>

        {error && <p className="rounded-xl bg-red-500/15 p-3 text-sm text-red-800">{error}</p>}
        {info && <p className="rounded-xl bg-primary/15 p-3 text-sm text-primary">{info}</p>}

        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Updating…' : 'Update PIN'}
        </button>
      </form>

      <p className="text-center text-xs text-on-surface-variant">
        Forgot your current PIN? Speak to the depot manager — they can reset it.
      </p>
    </main>
  );
}
