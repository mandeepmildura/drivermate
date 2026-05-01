// Cloudflare Pages Function. Runs at /api/google-directions.
// Frontend (admin route editor) POSTs { fromLat, fromLng, toLat, toLng }.
// Returns { steps: [{ instruction, lat, lng, distance_m }] } or { error }.
//
// Why this exists: keeps GOOGLE_MAPS_API_KEY off the client. Admins use this
// to seed `route_stops` with real turn waypoints between V/Line stations
// (Mildura → Euston → Robinvale ...) so the run-screen turn-by-turn banner
// has something to show on each leg.

type Env = {
  GOOGLE_MAPS_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
};

type IncomingBody = {
  fromLat?: number;
  fromLng?: number;
  toLat?: number;
  toLng?: number;
};

type DirectionsStep = {
  instruction: string;
  lat: number;
  lng: number;
  distance_m: number;
};

const ALLOWED_ORIGINS = new Set([
  'https://drivermate.pages.dev',
  'http://localhost:5173',
  'http://localhost:8788',
]);

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://drivermate.pages.dev';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, authorization',
    Vary: 'Origin',
  };
}

function jsonResponse(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders(origin) },
  });
}

export const onRequestOptions: PagesFunction<Env> = ({ request }) => {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) });
};

async function verifyAdmin(
  env: Env,
  authHeader: string | null,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return { ok: false, status: 401, message: 'Missing bearer token' };
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return { ok: false, status: 500, message: 'Server missing Supabase env vars' };
  }
  const token = authHeader.slice(7).trim();
  const url = `${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/drivers?select=is_admin&limit=1`;
  let resp: Response;
  try {
    resp = await fetch(url, {
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        authorization: `Bearer ${token}`,
        accept: 'application/json',
      },
    });
  } catch (err) {
    return { ok: false, status: 502, message: `Auth check failed: ${(err as Error).message}` };
  }
  if (resp.status === 401 || resp.status === 403) {
    return { ok: false, status: 401, message: 'Invalid or expired session' };
  }
  if (!resp.ok) {
    return { ok: false, status: 502, message: `Auth check returned ${resp.status}` };
  }
  const rows = (await resp.json()) as Array<{ is_admin?: boolean }>;
  if (!rows.length) {
    return { ok: false, status: 403, message: 'No driver row linked to this account' };
  }
  if (!rows[0].is_admin) {
    return { ok: false, status: 403, message: 'Admin access required' };
  }
  return { ok: true };
}

// Strip the HTML tags Google embeds in step instructions ("Turn <b>left</b> onto
// <span class=...>Sturt Hwy</span>"). Decode the small HTML entities Google
// actually emits — &amp;, &nbsp;, &#39;, &quot;, &lt;, &gt; — without pulling
// in a full HTML parser.
function stripHtml(input: string): string {
  let s = input.replace(/<[^>]*>/g, ' ');
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
  return s.replace(/\s+/g, ' ').trim();
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const origin = request.headers.get('origin');

  if (!env.GOOGLE_MAPS_API_KEY) {
    return jsonResponse({ error: 'Server missing GOOGLE_MAPS_API_KEY' }, 500, origin);
  }

  const authResult = await verifyAdmin(env, request.headers.get('authorization'));
  if (!authResult.ok) {
    return jsonResponse({ error: authResult.message }, authResult.status, origin);
  }

  let body: IncomingBody;
  try {
    body = (await request.json()) as IncomingBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400, origin);
  }

  const { fromLat, fromLng, toLat, toLng } = body;
  for (const v of [fromLat, fromLng, toLat, toLng]) {
    if (typeof v !== 'number' || Number.isNaN(v)) {
      return jsonResponse({ error: 'fromLat, fromLng, toLat, toLng must all be numbers' }, 400, origin);
    }
  }

  const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
  url.searchParams.set('origin', `${fromLat},${fromLng}`);
  url.searchParams.set('destination', `${toLat},${toLng}`);
  url.searchParams.set('mode', 'driving');
  // Skip motorway-only restrictions; for V/Line we want highway routing as-is.
  url.searchParams.set('units', 'metric');
  url.searchParams.set('key', env.GOOGLE_MAPS_API_KEY);

  let upstream: Response;
  try {
    upstream = await fetch(url.toString());
  } catch (err) {
    return jsonResponse({ error: `Google fetch failed: ${(err as Error).message}` }, 502, origin);
  }

  if (!upstream.ok) {
    const text = await upstream.text();
    return jsonResponse({ error: `Google ${upstream.status}: ${text.slice(0, 500)}` }, 502, origin);
  }

  type GoogleStep = {
    html_instructions?: string;
    distance?: { value?: number };
    end_location?: { lat?: number; lng?: number };
  };
  type GoogleLeg = { steps?: GoogleStep[] };
  type GoogleRoute = { legs?: GoogleLeg[] };
  const data = (await upstream.json()) as { status?: string; routes?: GoogleRoute[]; error_message?: string };

  if (data.status !== 'OK') {
    return jsonResponse(
      { error: `Google status: ${data.status} ${data.error_message ?? ''}`.trim() },
      502,
      origin,
    );
  }

  const route = data.routes?.[0];
  const allSteps: GoogleStep[] = route?.legs?.flatMap((l) => l.steps ?? []) ?? [];

  const steps: DirectionsStep[] = allSteps
    .map((s): DirectionsStep | null => {
      const lat = s.end_location?.lat;
      const lng = s.end_location?.lng;
      const distance_m = s.distance?.value ?? 0;
      const instruction = s.html_instructions ? stripHtml(s.html_instructions) : '';
      if (typeof lat !== 'number' || typeof lng !== 'number' || !instruction) return null;
      return { instruction, lat, lng, distance_m };
    })
    .filter((s): s is DirectionsStep => s !== null);

  // Drop the final "Arrive at destination" step — the destination is already
  // a route_stop in DriverMate, no need to duplicate it as a turn waypoint.
  if (steps.length > 0) {
    const last = steps[steps.length - 1];
    if (/^arrive\b/i.test(last.instruction) || /^you have arrived/i.test(last.instruction)) {
      steps.pop();
    }
  }

  return jsonResponse({ steps }, 200, origin);
};
