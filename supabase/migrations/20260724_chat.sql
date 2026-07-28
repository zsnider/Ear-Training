-- ============================================================
-- SonicSandbox Chat — Battle Board + Direct Messages
-- Run this entire file in the Supabase SQL Editor once.
-- ============================================================

-- ── 1. battle_posts — public Battle Board feed ────────────────
-- One row per forum post. Anyone can read; only auth users can insert.
CREATE TABLE IF NOT EXISTS public.battle_posts (
  id          BIGSERIAL   PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  username    TEXT        NOT NULL,
  message     TEXT        NOT NULL CHECK (char_length(message) BETWEEN 1 AND 500),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.battle_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "battle_posts: anyone can read"
  ON public.battle_posts FOR SELECT USING (true);

CREATE POLICY "battle_posts: auth users can insert as self"
  ON public.battle_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "battle_posts: owners can delete"
  ON public.battle_posts FOR DELETE
  USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_posts;

-- ── 2. direct_messages — DMs between authenticated users ──────
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id                  BIGSERIAL   PRIMARY KEY,
  sender_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_username     TEXT        NOT NULL,
  recipient_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_username  TEXT        NOT NULL,
  message             TEXT        NOT NULL CHECK (char_length(message) BETWEEN 1 AND 1000),
  read                BOOLEAN     NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Sender and recipient can both read the message
CREATE POLICY "direct_messages: sender or recipient can read"
  ON public.direct_messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Users can only send as themselves
CREATE POLICY "direct_messages: insert as self"
  ON public.direct_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Only recipient can mark as read
CREATE POLICY "direct_messages: recipient can mark read"
  ON public.direct_messages FOR UPDATE
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;

-- ── Done ─────────────────────────────────────────────────────
-- After running this, make sure Realtime replication is enabled
-- for battle_posts and direct_messages in:
--   Supabase Dashboard → Database → Replication
