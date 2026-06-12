-- =============================================================
-- Migration: indexes + RLS tightening for score saves
-- Run in: Supabase Dashboard → SQL Editor (or via Supabase CLI)
-- =============================================================


-- ── 1. Performance indexes on scores ─────────────────────────
-- Covers the most common query patterns:
--   • getScores(game?)  → filter by user_id, optionally game, order by created_at DESC
--   • rate-limit check  → filter by user_id + created_at range
--   • stats page        → filter by user_id

-- Primary index: user stats + game filter + time-ordered results
CREATE INDEX IF NOT EXISTS idx_scores_user_game_time
  ON scores (user_id, game, created_at DESC);

-- Secondary index: covers rate-limit window queries (user_id + created_at only)
-- The composite index above already satisfies this, but an explicit partial
-- index on just these two columns is slightly cheaper for the rate-limit COUNT.
CREATE INDEX IF NOT EXISTS idx_scores_user_time
  ON scores (user_id, created_at DESC);


-- ── 2. raw_score column (idempotent) ──────────────────────────
-- Add the column if it wasn't already created.
ALTER TABLE scores
  ADD COLUMN IF NOT EXISTS raw_score INTEGER;


-- ── 3. Tighten RLS — block direct client INSERTs ──────────────
-- Previously, clients could insert rows directly (bypassing validation).
-- Now all inserts go through the save-score Edge Function (service role),
-- so the user INSERT policy is no longer needed.

-- Drop the old permissive INSERT policy if it exists.
-- (Check your policy name in Supabase Dashboard → Authentication → Policies
--  if the name differs from the one below.)
DROP POLICY IF EXISTS "Users can insert their own scores" ON scores;
DROP POLICY IF EXISTS "Users can insert own scores"       ON scores;
DROP POLICY IF EXISTS "Allow authenticated insert"        ON scores;

-- Keep the existing SELECT policy intact so getScores() still works:
--   "Users can read their own scores"  →  USING (auth.uid() = user_id)
-- (No changes needed to SELECT policies.)

-- ── Done ──────────────────────────────────────────────────────
-- After running this migration, deploy the save-score Edge Function
-- (see deployment steps in supabase/functions/save-score/index.ts comments).
