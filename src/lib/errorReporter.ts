import { db } from './db';
import { getSupabase, isSupabaseConfigured } from './supabase';

/**
 * Lightweight production error reporter.
 *
 * Catches uncaught exceptions and unhandled promise rejections, plus exposes
 * a `reportError()` for manual logging. Errors are best-effort: we never let
 * a logging failure cause cascading errors. Direct insert to Supabase if
 * online (so admins see crashes in real time), and silent drop otherwise —
 * this is observability, not data the driver needs preserved.
 */

type Source = 'window.error' | 'unhandledrejection' | 'manual';

interface ReportInput {
  source: Source;
  message: string;
  stack?: string | null;
  context?: Record<string, unknown>;
}

let started = false;
let pendingFlush = 0;
const MAX_QUEUED = 50; // hard cap to prevent runaway loops

/**
 * Manually log an error from anywhere in the app. Safe to call from inside
 * a catch block — never throws.
 */
export function reportError(message: string, opts: { stack?: string | null; context?: Record<string, unknown> } = {}): void {
  void send({ source: 'manual', message, stack: opts.stack ?? null, context: opts.context });
}

/**
 * Wire up window.error and unhandledrejection listeners. Idempotent.
 */
export function startErrorReporter(): void {
  if (started || typeof window === 'undefined') return;
  started = true;

  window.addEventListener('error', (event) => {
    void send({
      source: 'window.error',
      message: event.message || String(event.error),
      stack: event.error?.stack ?? null,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason ?? 'unknown rejection');
    const stack = reason instanceof Error ? reason.stack ?? null : null;
    void send({ source: 'unhandledrejection', message, stack });
  });
}

async function send(input: ReportInput): Promise<void> {
  if (!isSupabaseConfigured) return;
  if (pendingFlush >= MAX_QUEUED) return;
  pendingFlush += 1;
  try {
    const supabase = getSupabase();
    const driver = (await db.drivers.toCollection().first().catch(() => null))?.id ?? null;
    const shift = (await db.shifts
      .filter((s) => s.ended_at === null)
      .first()
      .catch(() => null))?.id ?? null;

    await supabase.from('client_errors').insert({
      driver_id: driver,
      shift_id: shift,
      source: input.source,
      message: truncate(input.message, 1000),
      stack: input.stack ? truncate(input.stack, 4000) : null,
      url: typeof window !== 'undefined' ? window.location.href : null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      app_version: import.meta.env.VITE_APP_VERSION ?? null,
      context: input.context ? (input.context as never) : null,
    });
  } catch {
    // Swallow — never let logging failures crash the app
  } finally {
    pendingFlush -= 1;
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
