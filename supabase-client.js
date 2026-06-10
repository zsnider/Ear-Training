// supabase-client.js — shared SonicSandbox auth + score client
// Games: import with <script src="../supabase-client.js"></script>
// Landing page: import with <script src="./supabase-client.js"></script>

const SUPABASE_URL = 'https://aolaxmmrmvovbzumlybe.supabase.co';
const SUPABASE_KEY = 'sb_publishable_C36QQ0xF6HUcnGVliS4dnw_eRc0VKfb';

const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let _currentUser = null;
let _initialSessionFired = false;

// Keep in sync as auth state changes.
// We wrap dispatches in setTimeout(0) so ss:authchange always fires as a
// macrotask — after every page's inline <script> has had a chance to attach
// its listener.  Without this, Supabase's INITIAL_SESSION (and the old
// getSession().then()) resolves as a microtask between <script> tags, so
// listeners set up in the very next <script> block miss the event entirely.
_sb.auth.onAuthStateChange((_event, session) => {
  _currentUser = session?.user ?? null;
  if (_event === 'INITIAL_SESSION') _initialSessionFired = true;
  const user = _currentUser;   // capture before the timeout fires
  const evt  = _event;
  setTimeout(() => {
    document.dispatchEvent(new CustomEvent('ss:authchange', { detail: user }));
    if (evt === 'PASSWORD_RECOVERY') {
      document.dispatchEvent(new CustomEvent('ss:passwordrecovery', { detail: user }));
    }
  }, 0);
});

// Belt-and-suspenders: also dispatch via a direct getSession() call.
// In some Supabase v2 versions the INITIAL_SESSION event can be missed
// (e.g. when the inline listener is registered in a later script block).
// This ensures ss:authchange always fires on every page load, regardless
// of whether onAuthStateChange's INITIAL_SESSION beat the listener.
_sb.auth.getSession().then(({ data: { session } }) => {
  _currentUser = session?.user ?? null;
  if (!_initialSessionFired) {
    const user = _currentUser;
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('ss:authchange', { detail: user }));
    }, 0);
  }
});

window.SonicSandbox = {

  getUser() {
    return _currentUser;
  },

  async getSession() {
    const { data: { session } } = await _sb.auth.getSession();
    return session;
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
  // Scores are validated and saved server-side via the save-score Edge Function.
  // The Edge Function verifies the JWT, checks score ranges, enforces rate limits,
  // and inserts using the service role key (so client INSERT is blocked by RLS).
  async saveScore({ game, correct, roundScore = null, rawScore = null }) {
    if (!_currentUser) return; // not logged in — skip silently

    const { data: { session } } = await _sb.auth.getSession();
    if (!session) return;

    const body = { game, correct, roundScore, rawScore };

    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/save-score`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: res.statusText }));
        console.warn('[SonicSandbox] score save failed:', error);
      }
    } catch (err) {
      console.warn('[SonicSandbox] score save network error:', err);
    }
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

  // Fetch the current user's profile row (includes username)
  async getProfile() {
    if (!_currentUser) return null;
    const { data } = await _sb
      .from('profiles')
      .select('*')
      .eq('id', _currentUser.id)
      .maybeSingle();
    return data;
  },

  // Create or update the username for the current user
  async setUsername(username) {
    if (!_currentUser) return { error: { message: 'Not signed in.' } };
    const { error } = await _sb
      .from('profiles')
      .upsert({ id: _currentUser.id, username: username.trim() });
    return { error };
  },

  // Returns true if the username is already taken (case-insensitive).
  // Pass excludeSelf=true when editing so your own name doesn't register as taken.
  // Requires a Supabase RLS SELECT policy that allows reading any profile row
  // (needed for leaderboards too). Add in Supabase SQL Editor:
  //   CREATE POLICY "Anyone can read profiles"
  //   ON profiles FOR SELECT USING (true);
  async isUsernameTaken(username, excludeSelf = false) {
    let q = _sb
      .from('profiles')
      .select('id')
      .ilike('username', username.trim());
    if (excludeSelf && _currentUser) q = q.neq('id', _currentUser.id);
    const { data } = await q.maybeSingle();
    return !!data;
  },

  // Send a password-reset email. The link redirects to /account/ where the
  // ss:passwordrecovery event is caught and a set-new-password form is shown.
  async resetPasswordForEmail(email) {
    const redirectTo = window.location.origin + '/account/';
    const { error } = await _sb.auth.resetPasswordForEmail(email, { redirectTo });
    return { error };
  },

  // Update the current user's password (call after PASSWORD_RECOVERY event).
  async updatePassword(newPassword) {
    const { error } = await _sb.auth.updateUser({ password: newPassword });
    return { error };
  },

  // Dashboard stats: today's rounds, this-week rounds, day streak.
  // Queries only created_at from the last 90 days for efficiency.
  async getDashboardStats() {
    if (!_currentUser) return null;
    const since = new Date();
    since.setDate(since.getDate() - 90);
    const { data, error } = await _sb
      .from('scores')
      .select('created_at')
      .eq('user_id', _currentUser.id)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false });
    if (error || !data) return { today: 0, week: 0, streak: 0 };

    const toLocal = d => new Date(d).toLocaleDateString('en-CA'); // YYYY-MM-DD
    const todayStr = toLocal(new Date());
    const weekAgo  = new Date(Date.now() - 7 * 86400000);
    let today = 0, week = 0;
    const daySet = new Set();
    for (const s of data) {
      const d = new Date(s.created_at);
      const ds = toLocal(d);
      if (ds === todayStr) today++;
      if (d >= weekAgo) week++;
      daySet.add(ds);
    }
    // Streak: consecutive days ending today (or yesterday if nothing yet today)
    let streak = 0;
    const check = new Date();
    if (!daySet.has(todayStr)) check.setDate(check.getDate() - 1);
    while (daySet.has(toLocal(check))) {
      streak++;
      check.setDate(check.getDate() - 1);
    }
    return { today, week, streak };
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
