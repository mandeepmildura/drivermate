// Cloudflare Pages Function. Runs at /api/vline-ocr.
// Frontend POSTs { routeCode, images: [{ base64, mediaType }] }.
// Returns { passengers: Passenger[] } or { error }.
//
// Why this exists: keeps ANTHROPIC_API_KEY off the client.

type Env = { ANTHROPIC_API_KEY: string };

type IncomingImage = { base64: string; mediaType: string };
type IncomingBody = { routeCode?: string; images?: IncomingImage[] };

const VALID_ROUTES = ['C011', 'C012'] as const;
const ALLOWED_ORIGINS = new Set([
  'https://drivermate.pages.dev',
  'http://localhost:5173',
  'http://localhost:8788',
]);

const STOP_CODES_C012 = ['BXG', 'SPE', 'BRL', 'DHX', 'KRA', 'LCH', 'LBG', 'SWH', 'NYH', 'WOO', 'PGL', 'MGN', 'ANU', 'BNN', 'RBC', 'EUS', 'MQL'];

const MODEL_ID = 'claude-sonnet-4-20250514';
const MAX_IMAGES = 5;
const MAX_BYTES = 4 * 1024 * 1024;

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://drivermate.pages.dev';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
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

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const origin = request.headers.get('origin');

  if (!env.ANTHROPIC_API_KEY) {
    return jsonResponse({ error: 'Server missing ANTHROPIC_API_KEY' }, 500, origin);
  }

  let body: IncomingBody;
  try {
    body = (await request.json()) as IncomingBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400, origin);
  }

  const routeCode = body.routeCode;
  if (!routeCode || !VALID_ROUTES.includes(routeCode as (typeof VALID_ROUTES)[number])) {
    return jsonResponse({ error: 'routeCode must be C011 or C012' }, 400, origin);
  }

  const images = body.images;
  if (!Array.isArray(images) || images.length === 0) {
    return jsonResponse({ error: 'images required (1..5)' }, 400, origin);
  }
  if (images.length > MAX_IMAGES) {
    return jsonResponse({ error: `max ${MAX_IMAGES} images` }, 400, origin);
  }
  for (const img of images) {
    if (!img || typeof img.base64 !== 'string' || typeof img.mediaType !== 'string') {
      return jsonResponse({ error: 'each image needs base64 + mediaType' }, 400, origin);
    }
    // base64 length * 3/4 ≈ decoded bytes
    const approxBytes = Math.floor((img.base64.length * 3) / 4);
    if (approxBytes > MAX_BYTES) {
      return jsonResponse({ error: 'image > 4 MB after decode' }, 400, origin);
    }
  }

  // Build the Claude messages call.
  const stopList = STOP_CODES_C012.join(', ');
  const systemPrompt = [
    'You are reading a V/Line Sunlink coach passenger manifest from photographs.',
    `The route is ${routeCode}. Valid stop codes are exactly: ${stopList}.`,
    'For every passenger row visible across all photos, extract:',
    '- seat: e.g. "B1", "C12" (uppercase letter + number, no spaces). Empty string if not visible.',
    '- name: passenger name as written.',
    '- joinStop: 3-letter stop code from the allowed list where they board.',
    '- leaveStop: 3-letter stop code from the allowed list where they alight.',
    '- ticketType: "eTicket" or "Paper" — usually shown as an icon, ticket number prefix, or column.',
    '- priority: true if marked as priority/accessibility seating, otherwise false.',
    'If a stop name is written out in full, map it to the 3-letter code (e.g. "Mildura"→"MQL", "Bendigo"→"BXG").',
    'If a column is missing or unreadable, make your best guess but never invent a passenger.',
    'Skip header rows, totals, and crew entries.',
    'Respond with STRICT JSON only, no prose, no markdown fence:',
    '{"passengers":[{"seat":"","name":"","joinStop":"","leaveStop":"","ticketType":"eTicket","priority":false}, ...]}',
  ].join('\n');

  const userContent: Array<Record<string, unknown>> = images.map((img) => ({
    type: 'image',
    source: { type: 'base64', media_type: img.mediaType, data: img.base64 },
  }));
  userContent.push({
    type: 'text',
    text: `Read this ${routeCode} manifest and return the passengers JSON.`,
  });

  const apiBody = {
    model: MODEL_ID,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  };

  let upstream: Response;
  try {
    upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(apiBody),
    });
  } catch (err) {
    return jsonResponse({ error: `Upstream fetch failed: ${(err as Error).message}` }, 502, origin);
  }

  if (!upstream.ok) {
    const errText = await upstream.text();
    return jsonResponse({ error: `Anthropic ${upstream.status}: ${errText.slice(0, 500)}` }, 502, origin);
  }

  const apiJson = (await upstream.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const textBlock = (apiJson.content ?? []).find((b) => b.type === 'text')?.text ?? '';

  // Extract JSON object from the response, tolerating optional ```json fences.
  const fenced = textBlock.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : textBlock;
  const objectMatch = candidate.match(/\{[\s\S]*\}/);
  if (!objectMatch) {
    return jsonResponse({ error: 'Model returned no JSON object', raw: textBlock.slice(0, 500) }, 502, origin);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(objectMatch[0]);
  } catch (err) {
    return jsonResponse(
      { error: `JSON parse failed: ${(err as Error).message}`, raw: textBlock.slice(0, 500) },
      502,
      origin,
    );
  }

  return jsonResponse(parsed, 200, origin);
};
