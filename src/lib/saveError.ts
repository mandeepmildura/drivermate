// Plain-English translation for the most common save-time errors that
// admins were silently hitting (FK rejection on driven routes, RLS denial,
// expired session). The raw Postgres / Supabase strings are technical noise
// to a non-developer; they were getting buried in tiny error banners and
// users were assuming saves had succeeded. Each entry returns a banner-ready
// title + body. Falls back to the raw message for anything we don't
// recognise — better to show technical text than silently swallow.

export interface SaveError {
  title: string;
  detail: string;
  raw: string;
}

export function describeSaveError(err: unknown): SaveError {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (lower.includes('stop_events_route_stop_id_fkey')) {
    return {
      title: "Couldn't delete a stop that's already been driven.",
      detail:
        'This route has run history that references the stop you tried to remove. ' +
        'The schema has been updated to allow this; please reload the page and try again.',
      raw,
    };
  }
  if (lower.includes('foreign key constraint') || lower.includes('fkey')) {
    return {
      title: "A row couldn't be saved because something else still depends on it.",
      detail:
        "Usually this means an item you're trying to delete is referenced by " +
        'historical run data. Reload and try again, or contact the developer ' +
        'with the details below if this keeps happening.',
      raw,
    };
  }
  if (lower.includes('row-level security') || lower.includes('rls') || lower.includes('permission denied')) {
    return {
      title: "Save was blocked by access rules.",
      detail:
        'Either your admin permissions changed, or the route is locked. ' +
        'Make sure the route is unlocked and that you are signed in as an admin.',
      raw,
    };
  }
  if (lower.includes('jwt') || lower.includes('expired') || lower.includes('session')) {
    return {
      title: 'Your sign-in session expired while you were editing.',
      detail:
        'Your edits since the last successful save were not sent. Please sign out, ' +
        'sign back in, and re-do the changes.',
      raw,
    };
  }
  if (lower.includes('duplicate key') || lower.includes('unique constraint')) {
    return {
      title: 'Two rows ended up with the same identifier.',
      detail:
        'Usually a sequence number collision. Reload the page (the editor will ' +
        'pick up the latest server state) and try again.',
      raw,
    };
  }
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('network')) {
    return {
      title: "Couldn't reach the server.",
      detail:
        "You may be offline or on a flaky connection. Your changes haven't been " +
        'saved yet. Stay on this page and try again when you have signal.',
      raw,
    };
  }

  return {
    title: 'Save failed.',
    detail:
      'The server rejected the change. Details below — if this keeps happening, ' +
      'screenshot it and send it to the developer.',
    raw,
  };
}
