// supabase/functions/save-score/index.ts
// ========================================
// Validates and saves a game round score.
//
// POST /functions/v1/save-score
// Authorization: Bearer <supabase access token>
// Content-Type: application/json
// Body: { game, correct, roundScore, rawScore? }
//
// Rejects:
//   - Missing / invalid JWT
//   - Unknown game slug
//   - Out-of-range scores
//   - More than 10 saves per user per minute (rate limit)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Known game slugs ──────────────────────────────────────────────
const VALID_GAMES = new Set([
  'eq-match',
  'compressor',
  'freq-quiz',
  'level-logic',
  'quick-eq',
  'quick-compress',
  'freq-hunter',
  'spatial-specialist',
  'signal-chain-architect',
  'reverb-master',
  'distortion-master',
  'delay-master',
]);

// ── Score bounds ──────────────────────────────────────────────────
// rawScore: 0–100 (unweighted base percentage)
// roundScore: −10 to 1000
//   Upper bound: 100 (max raw) × 6.4 (max multiplier, EQ Match hard 3-band)
//   ≈ 640, rounded up to 1000 for future games. Lower: partial-credit floors.
const RAW_MIN   =    0;
const RAW_MAX   =  100;
const ROUND_MIN =  -10;
const ROUND_MAX = 1000;

// ── Rate limit ────────────────────────────────────────────────────
const RATE_LIMIT_COUNT  = 10;   // max inserts
const RATE_LIMIT_WINDOW = 60;   // seconds

// ── CORS headers ──────────────────────────────────────────────────
const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // ── 1. Verify JWT ─────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    return json({ error: 'Missing Authorization header' }, 401);
  }

  // We use the anon key for the user-facing client, but validate the JWT
  // via getUser() which hits Supabase auth and returns the verified user.
  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data: { user }, error: authError } = await anonClient.auth.getUser();
  if (authError || !user) {
    return json({ error: 'Invalid or expired token' }, 401);
  }

  // ── 2. Parse body ─────────────────────────────────────────────
  let body: { game?: unknown; correct?: unknown; roundScore?: unknown; rawScore?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { game, correct, roundScore, rawScore } = body;

  // ── 3. Validate game slug ─────────────────────────────────────
  if (typeof game !== 'string' || !VALID_GAMES.has(game)) {
    return json({ error: `Unknown game slug: ${game}` }, 400);
  }

  // ── 4. Validate correct flag ──────────────────────────────────
  if (typeof correct !== 'boolean') {
    return json({ error: '`correct` must be a boolean' }, 400);
  }

  // ── 5. Validate roundScore ────────────────────────────────────
  if (roundScore !== null && roundScore !== undefined) {
    if (typeof roundScore !== 'number' || !isFinite(roundScore)) {
      return json({ error: '`roundScore` must be a finite number' }, 400);
    }
    if (roundScore < ROUND_MIN || roundScore > ROUND_MAX) {
      return json({ error: `roundScore out of range [${ROUND_MIN}, ${ROUND_MAX}]` }, 400);
    }
  }

  // ── 6. Validate rawScore ──────────────────────────────────────
  if (rawScore !== null && rawScore !== undefined) {
    if (typeof rawScore !== 'number' || !isFinite(rawScore)) {
      return json({ error: '`rawScore` must be a finite number' }, 400);
    }
    if (rawScore < RAW_MIN || rawScore > RAW_MAX) {
      return json({ error: `rawScore out of range [${RAW_MIN}, ${RAW_MAX}]` }, 400);
    }
  }

  // ── 7. Rate limit: max 10 inserts per user per minute ─────────
  // Use the service role client (bypasses RLS) to count recent inserts.
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW * 1000).toISOString();
  const { count, error: countError } = await serviceClient
    .from('scores')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', windowStart);

  if (countError) {
    console.error('[save-score] rate limit check failed:', countError.message);
    return json({ error: 'Internal server error' }, 500);
  }

  if ((count ?? 0) >= RATE_LIMIT_COUNT) {
    return json(
      { error: `Rate limit exceeded — max ${RATE_LIMIT_COUNT} saves per ${RATE_LIMIT_WINDOW}s` },
      429
    );
  }

  // ── 8. Insert using service role (bypasses RLS) ───────────────
  const row: Record<string, unknown> = {
    user_id:     user.id,
    game,
    correct,
    round_score: roundScore ?? null,
  };
  if (rawScore !== undefined && rawScore !== null) row.raw_score = rawScore;

  const { error: insertError } = await serviceClient.from('scores').insert(row);
  if (insertError) {
    console.error('[save-score] insert failed:', insertError.message);
    return json({ error: 'Failed to save score' }, 500);
  }

  return json({ ok: true });
});
