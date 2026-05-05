import { useState } from 'react';
import { describeSaveError } from '../lib/saveError';

// Loud, sticky save-error banner for admin write paths. The previous
// implementation was a single line of `text-xs` red text wedged between the
// "locked" and "Saved." banners — it was indistinguishable noise on a
// tablet, which is how an FK-rejection bug ate hours of admin edits without
// anyone noticing. This banner is full-width, large-font, has a "see
// technical details" disclosure, and stays put until dismissed.

interface Props {
  error: unknown;
  onDismiss?: () => void;
}

export function SaveErrorBanner({ error, onDismiss }: Props) {
  const [showRaw, setShowRaw] = useState(false);
  if (!error) return null;
  const { title, detail, raw } = describeSaveError(error);

  return (
    <div
      role="alert"
      className="shrink-0 border-y-2 border-red-500/50 bg-red-500/15 px-4 py-3 text-red-800"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-0.5 text-2xl leading-none">!</span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold">{title}</p>
          <p className="mt-1 text-sm leading-snug text-red-800">{detail}</p>
          <button
            type="button"
            onClick={() => setShowRaw((v) => !v)}
            className="mt-2 text-xs font-bold uppercase tracking-widest text-red-800 underline-offset-2 hover:underline"
          >
            {showRaw ? 'Hide technical details' : 'Show technical details'}
          </button>
          {showRaw && (
            <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-red-100 p-2 text-[11px] leading-snug text-red-800">
              {raw}
            </pre>
          )}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded-lg bg-red-500/20 px-3 py-1 text-xs font-bold uppercase tracking-widest text-red-800 hover:bg-red-500/30"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
