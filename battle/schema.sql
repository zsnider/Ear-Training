-- ============================================================
-- SonicSandbox Multiplayer Battle — Supabase SQL Schema
-- Run this entire file in the Supabase SQL Editor once.
-- ============================================================

-- ── 1. battles ───────────────────────────────────────────────
-- One row per active or completed battle room.
CREATE TABLE IF NOT EXISTS public.battles (
  id            TEXT        PRIMARY KEY,          -- 6-char room code e.g. "AX7K2Q"
  game          TEXT        NOT NULL DEFAULT 'freq-quiz',
  status        TEXT        NOT NULL DEFAULT 'waiting',
    -- 'waiting'  = host created, no guest yet
    -- 'active'   = both players present, game running
    -- 'finished' = game over

  host_id       TEXT        NOT NULL,             -- opaque session ID (not auth UID)
  host_name     TEXT        NOT NULL,
  guest_id      TEXT,
  guest_name    TEXT,

  host_score    INT         NOT NULL DEFAULT 0,
  guest_score   INT         NOT NULL DEFAULT 0,

  current_round INT         NOT NULL DEFAULT 0,
  total_rounds  INT         NOT NULL DEFAULT 10,

  -- Seeded so both clients generate identical questions
  current_seed  BIGINT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. matchmaking_queue ─────────────────────────────────────
-- Players waiting for a random opponent.
CREATE TABLE IF NOT EXISTS public.matchmaking_queue (
  session_id    TEXT        PRIMARY KEY,
  display_name  TEXT        NOT NULL,
  game          TEXT        NOT NULL DEFAULT 'freq-quiz',
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. Auto-update updated_at ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS battles_updated_at ON public.battles;
CREATE TRIGGER battles_updated_at
  BEFORE UPDATE ON public.battles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 4. RLS — enable but keep open for now ────────────────────
-- Battles use Realtime broadcast for game events (no per-round rows).
-- Table reads/writes are keyed by opaque session IDs, not auth UIDs,
-- so we allow all anon operations. Tighten later if needed.
ALTER TABLE public.battles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "battles: anyone can read"
  ON public.battles FOR SELECT USING (true);

CREATE POLICY "battles: anyone can insert"
  ON public.battles FOR INSERT WITH CHECK (true);

CREATE POLICY "battles: anyone can update"
  ON public.battles FOR UPDATE USING (true);

CREATE POLICY "queue: anyone can read"
  ON public.matchmaking_queue FOR SELECT USING (true);

CREATE POLICY "queue: anyone can insert"
  ON public.matchmaking_queue FOR INSERT WITH CHECK (true);

CREATE POLICY "queue: anyone can delete"
  ON public.matchmaking_queue FOR DELETE USING (true);

-- ── 5. Realtime — enable for both tables ─────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.battles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matchmaking_queue;

-- ── Done ─────────────────────────────────────────────────────
-- After running this, enable Realtime for these two tables in
-- the Supabase Dashboard → Database → Replication if it is not
-- already on for the whole schema.
