// scoring.js — SonicSandbox weighted scoring engine
// Include before supabase-client.js in each game:
//   <script src="../scoring.js"></script>
//
// API:
//   ScoringEngine.multiplier(game, settings)   → float  e.g. 2.5  (1.0 if weighted disabled)
//   ScoringEngine.points(game, settings)        → int    e.g. 250  (base 100 × multiplier)
//   ScoringEngine.label(game, settings)         → string e.g. "×2.5" (reflects effective multiplier)
//   ScoringEngine.weightedEnabled()             → bool
//   ScoringEngine.setWeighted(bool)             → void   (persists to localStorage)
//
// For accuracy-based games (Freq Hunter, Spatial Specialist, Compressor, etc.) the caller
// should do: Math.round(rawScore * ScoringEngine.multiplier(game, settings))

window.ScoringEngine = (() => {

  const LS_KEY = 'ss_weighted_scoring';

  // ── Multiplier tables ────────────────────────────────────────────────────────

  // Freq Quiz — keyed by gainAmount (dB)
  // Smaller boost/cut = harder to detect = more points
  const FREQ_QUIZ = { 12: 1.0, 9: 1.2, 6: 1.5, 4: 2.0, 3: 2.5, 2: 3.5 };

  // Level Logic — keyed by difficulty string
  const LEVEL_LOGIC = { easy: 1.0, medium: 1.5, hard: 2.5, expert: 4.0 };

  // Quick Compress — keyed by tier name
  // Subtle compression is hardest; easy (20:1) is very obvious
  const QUICK_COMPRESS = { easy: 1.0, medium: 1.4, hard: 1.8, subtle: 2.5 };

  // Quick EQ — two independent axes, multiplied together
  const QUICK_EQ_DIFF  = { easy: 1.0, medium: 1.5, hard: 2.2 };
  const QUICK_EQ_BANDS = { 1: 1.0, 2: 1.3, 3: 1.6 };

  // Spatial Specialist — uniform across game modes
  const SPATIAL = { panning: 1.0, width: 1.0 };

  // Freq Hunter — uniform across game modes
  const FREQ_HUNTER = { freq: 1.0, pan: 1.0, freqpan: 1.0 };

  // Compressor — preset difficulties keyed by name; custom mode = 0.3 × numParams
  // (threshold, ratio, attack, release, knee, makeup → up to 6 params → max ×1.8 in custom)
  const COMPRESSOR = { easy: 1.0, medium: 1.4, hard: 1.8, pro: 2.2 };

  // EQ Match — two axes: gainThreshold (training tier) × numBands (filter count)
  // All tier (gainThreshold=-1) ranges the full 0–12 dB window → base difficulty
  const EQ_MATCH_TIER  = { 10: 1.0, 8: 1.2, 6: 1.5, 4: 2.0, 2: 2.8, 0: 4.0, '-1': 1.0 };
  const EQ_MATCH_BANDS = { 1: 1.0, 2: 1.3, 3: 1.6 };

  // Reverb Master — keyed by difficulty (Pro = roomSize+decay+wet+preDelay)
  const REVERB = { easy: 1.0, medium: 1.4, hard: 1.8, pro: 2.2, custom: 2.5 };

  // Delay Master — base keyed by difficulty, plus per-param-count bonus
  // 1 param: +0  |  2 params: +0.3  |  3 params: +0.6
  const DELAY       = { easy: 1.0, medium: 1.5, hard: 2.0 };
  const DELAY_PARAMS = { 1: 0, 2: 0.3, 3: 0.6 };

  // Distortion Master — keyed by difficulty (Pro = drive+mix+type+tone)
  const DISTORTION = { easy: 1.0, medium: 1.4, hard: 1.8, pro: 2.2, custom: 2.5 };

  // Signal Chain Architect — two axes: difficulty × chainLength
  const SCA_DIFF  = { easy: 1.0, medium: 1.5, hard: 2.2 };
  const SCA_CHAIN = { 2: 1.0, 3: 1.3, 4: 1.6 };

  // ── Weighted toggle ──────────────────────────────────────────────────────────

  function weightedEnabled() {
    const stored = localStorage.getItem(LS_KEY);
    return stored === null ? true : stored === 'true';
  }

  function setWeighted(enabled) {
    localStorage.setItem(LS_KEY, enabled ? 'true' : 'false');
  }

  // ── Raw multiplier (always computed, ignores toggle) ─────────────────────────

  function rawMultiplier(game, settings = {}) {
    switch (game) {

      case 'freq-quiz':
        return FREQ_QUIZ[settings.gainAmount] ?? 1.0;

      case 'level-logic':
        return LEVEL_LOGIC[settings.difficulty] ?? 1.0;

      case 'quick-compress':
        return QUICK_COMPRESS[settings.tier] ?? 1.0;

      case 'quick-eq': {
        const dm = QUICK_EQ_DIFF[settings.difficulty]  ?? 1.0;
        const bm = QUICK_EQ_BANDS[settings.numBands]   ?? 1.0;
        return dm * bm;
      }

      case 'spatial-specialist':
        return SPATIAL[settings.mode] ?? 1.0;

      case 'freq-hunter':
        return FREQ_HUNTER[settings.mode] ?? 1.0;

      case 'compressor':
        if (settings.difficulty === 'custom')
          return parseFloat((0.3 * (settings.numParams || 1)).toFixed(2));
        return COMPRESSOR[settings.difficulty] ?? 1.0;

      case 'eq-match': {
        const key = String(settings.gainThreshold);
        const tm  = EQ_MATCH_TIER[key] ?? 1.0;
        const bm  = EQ_MATCH_BANDS[settings.difficulty] ?? 1.0;
        return tm * bm;
      }

      case 'reverb-master':
        return REVERB[settings.difficulty] ?? 1.0;

      case 'delay-master': {
        const base   = DELAY[settings.difficulty] ?? 1.0;
        const pBonus = DELAY_PARAMS[settings.numParams] ?? 0;
        return base + pBonus;
      }

      case 'distortion-master':
        return DISTORTION[settings.difficulty] ?? 1.0;

      case 'signal-chain-architect': {
        const dm = SCA_DIFF[settings.difficulty]   ?? 1.0;
        const cm = SCA_CHAIN[settings.chainLength] ?? 1.0;
        return dm * cm;
      }

      default:
        return 1.0;
    }
  }

  // ── Public helpers ───────────────────────────────────────────────────────────

  // Effective multiplier — returns 1.0 when weighted scoring is disabled
  function multiplier(game, settings = {}) {
    if (!weightedEnabled()) return 1.0;
    return rawMultiplier(game, settings);
  }

  // Base points for a correct binary answer, weighted by difficulty
  function points(game, settings = {}) {
    return Math.round(100 * multiplier(game, settings));
  }

  // Format a multiplier float to a display string, always one decimal place
  function fmt(m) {
    return `×${m.toFixed(1)}`;
  }

  // Display string for the difficulty badge — always shows the RAW (difficulty-based)
  // multiplier so the badge always reflects current settings regardless of the toggle.
  function label(game, settings = {}) {
    return fmt(rawMultiplier(game, settings));
  }

  // Display string for the scoring engine (respects the weighted toggle).
  // Use this if you need to show the effective (post-toggle) multiplier.
  function effectiveLabel(game, settings = {}) {
    return fmt(multiplier(game, settings));
  }

  return { multiplier, rawMultiplier, points, label, effectiveLabel, weightedEnabled, setWeighted };

})();
