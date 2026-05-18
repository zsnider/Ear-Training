// scoring.js — SonicSandbox weighted scoring engine
// Include before supabase-client.js in each game:
//   <script src="../scoring.js"></script>
//
// API:
//   ScoringEngine.multiplier(game, settings)  → float   e.g. 2.5
//   ScoringEngine.points(game, settings)       → int     e.g. 250  (base 100 × multiplier)
//   ScoringEngine.label(game, settings)        → string  e.g. "×2.5"
//
// For accuracy-based games (Freq Hunter, Spatial Specialist) the caller
// should do: Math.round(rawScore * ScoringEngine.multiplier(game, settings))

window.ScoringEngine = (() => {

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

  // Spatial Specialist — keyed by gameMode
  // Width mode requires centre-outward estimation, slightly harder
  const SPATIAL = { panning: 1.0, width: 1.2 };

  // Freq Hunter — keyed by gameMode
  // Freq+Pan tracks two independent axes simultaneously
  const FREQ_HUNTER = { freq: 1.0, pan: 1.0, freqpan: 1.5 };

  // ── Core helpers ─────────────────────────────────────────────────────────────

  function multiplier(game, settings = {}) {
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

      default:
        return 1.0;
    }
  }

  // Base points for a correct binary answer, weighted by difficulty
  function points(game, settings = {}) {
    return Math.round(100 * multiplier(game, settings));
  }

  // Display string shown in the UI, e.g. "×1.5" or "×2.5"
  function label(game, settings = {}) {
    const m = multiplier(game, settings);
    // Show one decimal only when not a whole number
    const str = Number.isInteger(m) ? `${m}` : m.toFixed(1).replace(/\.0$/, '');
    return `×${str}`;
  }

  return { multiplier, points, label };

})();
