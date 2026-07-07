// multiplayer.js — SonicSandbox real-time battle layer
// Uses Supabase Realtime (broadcast + postgres_changes) for:
//   • Room creation / joining (room code + random matchmaking)
//   • Round synchronisation (seeded question, both players identical prompt)
//   • Answer events (each player's answer, result, score delta)
//   • Presence (connected / disconnected)
//
// Usage:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
//   <script src="/multiplayer.js"></script>
//   Then use window.BattleRoom.*

(function (global) {
  'use strict';

  const SUPABASE_URL = 'https://aolaxmmrmvovbzumlybe.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_C36QQ0xF6HUcnGVliS4dnw_eRc0VKfb';

  // ── Internal Supabase client (separate from SonicSandbox auth client) ────
  const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    realtime: { params: { eventsPerSecond: 10 } },
  });

  // ── Module state ─────────────────────────────────────────────────────────
  let _roomCode    = null;   // 6-char code
  let _sessionId   = null;   // this player's opaque ID
  let _displayName = null;   // chosen display name
  let _role        = null;   // 'host' | 'guest'
  let _channel     = null;   // Realtime broadcast channel
  let _battleRow   = null;   // latest snapshot of battles row
  let _queueSub    = null;   // postgres_changes sub for matchmaking

  // Callbacks registered by the game page
  const _cbs = {
    stateChange   : [],   // (battleRow) — room joined, guest arrived, status changed
    roundStart    : [],   // ({ round, seed, totalRounds }) — new round ready to render
    opponentAnswer: [],   // ({ correct, score, answer }) — opponent submitted an answer
    opponentLeft  : [],   // () — opponent disconnected / left
    matched       : [],   // ({ roomCode, opponentName, role }) — random match found
    settingsChange: [],   // ({ gainAmount, direction, activeFreqs, sourceType }) — host changed settings
    error         : [],   // (message) — something went wrong
  };

  function _emit(event, payload) {
    (_cbs[event] || []).forEach(fn => { try { fn(payload); } catch(e) { console.error('[BattleRoom]', e); } });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function _makeCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  function _makeSessionId() {
    return 'ss_' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
  }

  function _makeSeed() {
    return Math.floor(Math.random() * 2 ** 32);
  }

  // Seeded PRNG (mulberry32) — deterministic from a 32-bit integer seed.
  // Both players call this with the same seed → same question every round.
  function _seededRandom(seed) {
    let s = seed >>> 0;
    return function () {
      s += 0x6D2B79F5;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ── Channel setup ─────────────────────────────────────────────────────────

  function _openChannel(code) {
    if (_channel) { _sb.removeChannel(_channel); _channel = null; }

    _channel = _sb.channel(`battle:${code}`, {
      config: { broadcast: { self: false } },
    });

    // Presence — detect opponent connecting / disconnecting
    _channel.on('presence', { event: 'join' }, ({ newPresences }) => {
      // Re-fetch battle row so UI can refresh names / status
      _fetchBattle(code);
    });

    _channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      const leftId = leftPresences[0]?.session_id;
      if (leftId && leftId !== _sessionId) {
        _emit('opponentLeft', {});
      }
    });

    // Broadcast: host → guest: new round
    _channel.on('broadcast', { event: 'round_start' }, ({ payload }) => {
      if (_role === 'guest') {
        _emit('roundStart', payload);
      }
    });

    // Broadcast: either player answered
    _channel.on('broadcast', { event: 'answer' }, ({ payload }) => {
      if (payload.sessionId !== _sessionId) {
        _emit('opponentAnswer', { correct: payload.correct, score: payload.score, answer: payload.answer });
      }
    });

    // Broadcast: host changed game settings (gain, direction, source, active freqs)
    _channel.on('broadcast', { event: 'settings_change' }, ({ payload }) => {
      if (payload.sessionId !== _sessionId) {
        _emit('settingsChange', payload.settings);
      }
    });

    // Broadcast: host signals game over
    _channel.on('broadcast', { event: 'battle_end' }, ({ payload }) => {
      _emit('stateChange', { ..._battleRow, status: 'finished', ...payload });
    });

    // Postgres changes — keep battle row in sync for score display
    _channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'battles', filter: `id=eq.${code}` },
      ({ new: row }) => {
        _battleRow = row;
        _emit('stateChange', row);
      }
    );

    _channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await _channel.track({ session_id: _sessionId, display_name: _displayName });
      }
    });
  }

  // ── DB helpers ────────────────────────────────────────────────────────────

  async function _fetchBattle(code) {
    const { data, error } = await _sb
      .from('battles')
      .select('*')
      .eq('id', code)
      .maybeSingle();
    if (error) { _emit('error', error.message); return null; }
    _battleRow = data;
    if (data) _emit('stateChange', data);
    return data;
  }

  async function _patchBattle(code, patch) {
    const { error } = await _sb.from('battles').update(patch).eq('id', code);
    if (error) _emit('error', error.message);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  const BattleRoom = {

    /**
     * Register an event handler.
     * Events: 'stateChange' | 'roundStart' | 'opponentAnswer' | 'opponentLeft' | 'matched' | 'error'
     */
    on(event, fn) {
      if (_cbs[event]) _cbs[event].push(fn);
      return this;
    },

    off(event, fn) {
      if (_cbs[event]) _cbs[event] = _cbs[event].filter(f => f !== fn);
      return this;
    },

    /** Current room code (null if not in a room). */
    get roomCode() { return _roomCode; },

    /** 'host' | 'guest' | null */
    get role() { return _role; },

    /** Latest battle row snapshot. */
    get battleRow() { return _battleRow; },

    /** This player's session ID. */
    get sessionId() { return _sessionId; },

    // ── Room management ──────────────────────────────────────────────────

    /**
     * Create a new room. Returns the 6-char room code.
     * @param {string} displayName
     * @param {string} [game='freq-quiz']
     * @param {number} [totalRounds=10]
     */
    async createRoom(displayName, game = 'freq-quiz', totalRounds = 5) {
      _sessionId   = _makeSessionId();
      _displayName = displayName.trim() || 'Player 1';
      _role        = 'host';

      let code, attempts = 0;
      while (attempts < 5) {
        code = _makeCode();
        const { error } = await _sb.from('battles').insert({
          id           : code,
          game,
          status       : 'waiting',
          host_id      : _sessionId,
          host_name    : _displayName,
          total_rounds : totalRounds,
        });
        if (!error) break;
        if (error.code !== '23505') { _emit('error', error.message); return null; } // PK collision → retry
        attempts++;
      }

      _roomCode = code;
      await _fetchBattle(code);
      _openChannel(code);
      return code;
    },

    /**
     * Join an existing room by code.
     * @param {string} code
     * @param {string} displayName
     */
    async joinRoom(code, displayName) {
      code = code.trim().toUpperCase();
      _sessionId   = _makeSessionId();
      _displayName = displayName.trim() || 'Player 2';
      _role        = 'guest';

      const battle = await _fetchBattle(code);
      if (!battle) { _emit('error', 'Room not found.'); return false; }
      if (battle.status !== 'waiting') { _emit('error', 'This room is no longer open.'); return false; }
      if (battle.guest_id) { _emit('error', 'Room is full.'); return false; }

      await _patchBattle(code, {
        guest_id  : _sessionId,
        guest_name: _displayName,
        status    : 'active',
      });

      _roomCode = code;
      _openChannel(code);
      return true;
    },

    /**
     * Enter random matchmaking queue.
     * When a match is found, fires 'matched' event with { roomCode, opponentName, role }.
     * @param {string} displayName
     * @param {string} [game='freq-quiz']
     */
    async joinQueue(displayName, game = 'freq-quiz') {
      _sessionId   = _makeSessionId();
      _displayName = displayName.trim() || 'Player';

      // Clean up stale queue entries (> 60s old) as a courtesy
      await _sb.from('matchmaking_queue')
        .delete()
        .lt('joined_at', new Date(Date.now() - 60000).toISOString());

      // Look for an existing waiter in this game
      const { data: waiting } = await _sb
        .from('matchmaking_queue')
        .select('*')
        .eq('game', game)
        .neq('session_id', _sessionId)
        .order('joined_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (waiting) {
        // We become the guest — claim that waiter's session
        await _sb.from('matchmaking_queue').delete().eq('session_id', waiting.session_id);

        // Create the battle room using the waiter's session as host
        const code = _makeCode();
        await _sb.from('battles').insert({
          id          : code,
          game,
          status      : 'active',
          host_id     : waiting.session_id,
          host_name   : waiting.display_name,
          guest_id    : _sessionId,
          guest_name  : _displayName,
          total_rounds: 10,
        });

        _roomCode = code;
        _role = 'guest';
        await _fetchBattle(code);
        _openChannel(code);
        _emit('matched', { roomCode: code, opponentName: waiting.display_name, role: 'guest' });
        return;
      }

      // No waiter — add ourselves to the queue and subscribe for changes
      await _sb.from('matchmaking_queue').insert({
        session_id  : _sessionId,
        display_name: _displayName,
        game,
      });

      // Poll for a battle row where we appear as host_id (a guest will create it)
      // We use postgres_changes on battles table filtered by host_id
      if (_queueSub) { _sb.removeChannel(_queueSub); }
      _queueSub = _sb.channel('queue_watch_' + _sessionId)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'battles' },
          ({ new: row }) => {
            if (row.host_id === _sessionId) {
              // We were matched as host
              _sb.removeChannel(_queueSub); _queueSub = null;
              _roomCode = row.id;
              _role = 'host';
              _battleRow = row;
              _openChannel(row.id);
              _emit('matched', { roomCode: row.id, opponentName: row.guest_name, role: 'host' });
            }
          }
        )
        .subscribe();
    },

    /** Leave the matchmaking queue without starting a game. */
    async leaveQueue() {
      if (_sessionId) {
        await _sb.from('matchmaking_queue').delete().eq('session_id', _sessionId);
      }
      if (_queueSub) { _sb.removeChannel(_queueSub); _queueSub = null; }
    },

    // ── In-game ──────────────────────────────────────────────────────────

    /**
     * HOST ONLY — broadcast the next round to both players.
     * Returns the seed so the host can also render the round locally.
     * @param {number} [roundNumber] — defaults to current_round + 1
     */
    async startNextRound(roundNumber) {
      if (_role !== 'host') return null;
      const seed  = _makeSeed();
      const round = roundNumber ?? ((_battleRow?.current_round ?? 0) + 1);

      await _patchBattle(_roomCode, { current_round: round, current_seed: seed });

      await _channel.send({
        type   : 'broadcast',
        event  : 'round_start',
        payload: { round, seed, totalRounds: _battleRow?.total_rounds ?? 10 },
      });

      return { round, seed, totalRounds: _battleRow?.total_rounds ?? 10 };
    },

    /**
     * HOST ONLY — broadcast a settings change to the guest.
     * @param {{ gainAmount?, direction?, activeFreqs?, sourceType? }} settings
     */
    async broadcastSettings(settings) {
      if (_role !== 'host' || !_channel) return;
      await _channel.send({
        type   : 'broadcast',
        event  : 'settings_change',
        payload: { sessionId: _sessionId, settings },
      });
    },

    /**
     * Submit this player's answer for the current round.
     * Broadcasts to opponent and updates the score column in DB.
     * @param {boolean} correct
     * @param {number}  pointsDelta  — points earned this round
     * @param {*}       answer       — the actual answer value (e.g. frequency chosen)
     */
    async submitAnswer(correct, pointsDelta = 0, answer = null) {
      const scoreField = _role === 'host' ? 'host_score' : 'guest_score';
      const newScore   = ((_battleRow?.[scoreField] ?? 0) + (correct ? pointsDelta : 0));

      await _patchBattle(_roomCode, { [scoreField]: newScore });

      await _channel.send({
        type   : 'broadcast',
        event  : 'answer',
        payload: { sessionId: _sessionId, correct, score: newScore, answer },
      });
    },

    /**
     * HOST ONLY — signal that all rounds are done.
     */
    async endBattle() {
      if (_role !== 'host') return;
      await _patchBattle(_roomCode, { status: 'finished' });
      await _channel.send({ type: 'broadcast', event: 'battle_end', payload: {} });
    },

    /**
     * Re-attach to a channel after a page navigation.
     * The lobby stores sessionId + role in sessionStorage; the game page calls this
     * if BattleRoom has no active room (state was lost in navigation).
     * @param {string} code
     * @param {string} sessionId
     * @param {string} displayName
     * @param {string} role  'host' | 'guest'
     */
    async _reattach(code, sessionId, displayName, role) {
      _roomCode    = code;
      _sessionId   = sessionId;
      _displayName = displayName;
      _role        = role;
      await _fetchBattle(code);
      _openChannel(code);
    },

    /** Disconnect from the current room. */
    async leave() {
      if (_channel) { await _channel.untrack(); _sb.removeChannel(_channel); _channel = null; }
      await this.leaveQueue();
      _roomCode = _sessionId = _displayName = _role = _battleRow = null;
    },

    // ── Question generation ───────────────────────────────────────────────

    /**
     * Generate a deterministic freq-quiz round from a seed.
     * Returns { targetFreq, targetGain, isDirBoost, activeFreqs }
     * Mirrors the logic in freq-quiz/index.html so both clients get identical rounds.
     *
     * @param {number} seed
     * @param {number[]} freqPool  — array of all possible frequencies
     * @param {number[]} gainPool  — array of possible gain values (absolute, e.g. [3,6,12])
     * @param {number}   numActive — how many freq pads to show (e.g. 9)
     */
    generateFreqRound(seed, freqPool, gainPool, numActive) {
      const rng = _seededRandom(seed);

      // Pick a random subset of active frequencies
      const shuffled = [...freqPool].sort(() => rng() - 0.5);
      const active   = shuffled.slice(0, numActive);
      active.sort((a, b) => a - b);  // keep ascending order for display

      const targetFreq = active[Math.floor(rng() * active.length)];
      const gainAmt    = gainPool[Math.floor(rng() * gainPool.length)];
      const isDirBoost = rng() >= 0.5;
      const targetGain = isDirBoost ? gainAmt : -gainAmt;

      return { targetFreq, targetGain, gainAmount: gainAmt, isDirBoost, activeFreqs: new Set(active) };
    },
  };

  global.BattleRoom = BattleRoom;

}(window));
