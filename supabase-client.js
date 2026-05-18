// supabase-client.js — shared SonicSandbox auth + score client
// Games: import with <script src="../supabase-client.js"></script>
// Landing page: import with <script src="./supabase-client.js"></script>

const SUPABASE_URL = 'https://aolaxmmrmvovbzumlybe.supabase.co';
const SUPABASE_KEY = 'sb_publishable_C36QQ0xF6HUcnGVliS4dnw_eRc0VKfb';

const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let _currentUser = null;

// Restore session on load
_sb.auth.getSession().then(({ data: { session } }) => {
  _currentUser = session?.user ?? null;
  document.dispatchEvent(new CustomEvent('ss:authchange', { detail: _currentUser }));
});

// Keep in sync as auth state changes
_sb.auth.onAuthStateChange((_event, session) => {
  _currentUser = session?.user ?? null;
  document.dispatchEvent(new CustomEvent('ss:authchange', { detail: _currentUser }));
});

window.SonicSandbox = {

  getUser() {
    return _currentUser;
  },

  async signUp(email, password) {
    const { data, error } = await _sb.auth.signUp({ email, password });
    return { data, error };
  },

  async signIn(email, password) {
    const { data, error } = await _sb.auth.signInWithPassword({ email, password });
    return { data, error };
  },

  async signOut() {
    return _sb.auth.signOut();
  },

  // Call this at the end of each round in a game
  // game:       string slug e.g. 'eq-match', 'compressor', 'freq-quiz'
  // correct:    boolean
  // roundScore: weighted score (0–100 × difficulty multiplier) — stored in round_score
  // rawScore:   unweighted base score (0–100) — stored in raw_score for record-keeping
  //
  // To enable raw_score storage, run once in Supabase SQL Editor:
  //   ALTER TABLE scores ADD COLUMN IF NOT EXISTS raw_score INTEGER;
  async saveScore({ game, correct, roundScore = null, rawScore = null }) {
    if (!_currentUser) return; // not logged in — skip silently
    const row = {
      user_id: _currentUser.id,
      game,
      correct,
      round_score: roundScore,
    };
    if (rawScore !== null) row.raw_score = rawScore;
    const { error } = await _sb.from('scores').insert(row);
    if (error) console.warn('[SonicSandbox] score save failed:', error.message);
  },

  // Fetch score history for the current user, optionally filtered by game
  async getScores(game = null) {
    if (!_currentUser) return [];
    let q = _sb
      .from('scores')
      .select('*')
      .eq('user_id', _currentUser.id)
      .order('created_at', { ascending: false });
    if (game) q = q.eq('game', game);
    const { data, error } = await q;
    if (error) console.warn('[SonicSandbox] getScores failed:', error.message);
    return data ?? [];
  },

  // Summary: total rounds + accuracy per game (or across all games)
  async getStats(game = null) {
    const scores = await this.getScores(game);
    if (!scores.length) return { total: 0, correct: 0, accuracy: null };
    const correct = scores.filter(s => s.correct).length;
    return {
      total: scores.length,
      correct,
      accuracy: Math.round((correct / scores.length) * 100),
    };
  },

  // Delete the current user's account and all associated data.
  // Requires the `delete_user` SQL function in Supabase (run once in SQL Editor):
  //
  //   CREATE OR REPLACE FUNCTION delete_user()
  //   RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
  //   AS $$
  //   BEGIN
  //     DELETE FROM scores WHERE user_id = auth.uid();
  //     DELETE FROM auth.users WHERE id = auth.uid();
  //   END;
  //   $$;
  //
  async deleteAccount() {
    if (!_currentUser) return { error: { message: 'Not signed in.' } };
    const { error } = await _sb.rpc('delete_user');
    if (error) {
      console.warn('[SonicSandbox] deleteAccount failed:', error.message);
      return { error };
    }
    await _sb.auth.signOut();
    return { error: null };
  },
};
