// ─────────────────────────────────────────────────────────────
//  SonicSandbox — Music Theory Shared Utilities
//  Provides: sidebar data + renderer, piano SVG builder,
//            note frequencies, audio synthesis helpers.
//
//  Each module page must call:
//    buildSidebar('mt-notes')    ← pass the current course UID
//    initMobileSidebar()         ← after DOM is ready
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
//  SIDEBAR DATA  (keep in sync with learn/index.html)
// ─────────────────────────────────────────────────────────────

const AE_COURSES = [
  { num:1,  id:'eq',           label:'EQ',             url:'/learn/',               accent:'#5b6aff',
    lessons:['What is EQ?','The Frequency Spectrum','Sub Bass — 20 to 60 Hz','Bass — 60 to 250 Hz','Low Mids — 250 to 500 Hz','Midrange — 500 Hz to 2 kHz','High Mids — 2 to 6 kHz','Presence & Air — 6 to 20 kHz','EQ Filter Types','Practical EQ Tips'] },
  { num:2,  id:'gain-staging', label:'Gain Staging',   url:'/learn/gain-staging/',  accent:'#86efac',
    lessons:['What Is Gain Staging?','Decibels — The Language of Loudness','Clipping — When Signal Goes Too Hot','Headroom — Give Transients Room','How Gain Accumulates','Reading Meters — Peak, RMS, LUFS','The −18 dBFS Target','Input, Output & Gain Compensation','Gain Staging the Mix Bus'] },
  { num:3,  id:'compression',  label:'Compression',    url:'/learn/compression/',   accent:'#e8865a',
    lessons:['What is Compression?','How Compression Works','Threshold','Ratio','Attack','Release','Knee','Makeup Gain','Compressor Types','Parallel Compression','Sidechain Compression','Practical Tips'] },
  { num:4,  id:'saturation',   label:'Saturation',     url:'/learn/saturation/',    accent:'#fbbf24',
    lessons:['What is Saturation?','Even vs Odd Harmonics','Soft vs Hard Clipping','Drive','Tape Saturation','Tube Saturation','Transistor & Digital Clipping','Parallel Saturation','Where to Use Saturation','Practical Workflow'] },
  { num:5,  id:'reverb',       label:'Reverb',         url:'/learn/reverb/',        accent:'#a78bfa',
    lessons:['What is Reverb?','Direct Sound & Early Reflections','Wet/Dry Balance','Pre-delay','Decay Time','Room Reverb','Hall Reverb','Plate & Spring','Diffusion & Damping','Reverb in the Mix'] },
  { num:6,  id:'delay',        label:'Delay',          url:'/learn/delay/',         accent:'#f97316',
    lessons:['What is Delay?','Feedback & Repeats','Delay Time & Tempo Sync','Tape Delay','Analog Delay','Digital Delay & Ping-Pong','Modulation in Delay','The Haas Effect','Where to Use Delay','Practical Workflow'] },
  { num:7,  id:'soundstage',   label:'Spatial Mixing', url:'/learn/soundstage/',   accent:'#38bdf8',
    lessons:['Spatial Mixing','The Three Axes','Left & Right — Panning','Front & Back — Depth','Up & Down — Frequency as Height','Width — Mono vs Stereo','Reverb as Depth','Conventional Placement','Creating Space','Building Your Soundstage'] },
  { num:8,  id:'signal-chain', label:'Signal Chain',   url:'/learn/signal-chain/', accent:'#22d3ee',
    lessons:['What Is a Signal Chain?','Why Order Matters','Gate & Expander','EQ → Compression','Compression Before Saturation','Inserts vs Sends','Time-Based Effects Last','The Master Bus Chain','Signal Chain Templates'] },
  { num:9,  id:'modulation',   label:'Modulation',     url:'/learn/modulation/',   accent:'#34d399',
    lessons:['What is Modulation?','The LFO — Rate & Depth','Chorus','Flanger','Phaser','Tremolo','Vibrato','Telling Them Apart','Modulation in the Mix','Practical Workflow'] },
  { num:10, id:'limiting',     label:'Limiting',       url:'/learn/limiting/',     accent:'#fda4af',
    lessons:['What is a Limiter?','Ceiling, Threshold & Input Gain','Brickwall vs Dynamics Limiters','Release Time & Artifacts','LUFS in Depth','Streaming Normalization','True Peak','Practical Workflow'] },
];

const MT_COURSES = [
  { num:1, id:'notes',        label:'Notes & The Piano',     url:'/learn/music-theory/notes/',        accent:'#3ecf8e',
    lessons:['The 12 Notes','Sharps, Flats & Enharmonics','The Piano Keyboard','Octaves & Pitch Registers'] },
  { num:2, id:'intervals',    label:'Intervals',             url:'/learn/music-theory/intervals/',    accent:'#60e8ff',
    lessons:['Half Steps & Whole Steps','Naming Intervals','Perfect Intervals','Major & Minor Intervals','Augmented & Diminished'] },
  { num:3, id:'scales',       label:'Scales',                url:'/learn/music-theory/scales/',       accent:'#fbbf24',
    lessons:['The Major Scale','Natural Minor Scale','Harmonic & Melodic Minor','Pentatonic Scales','The Blues Scale','Modes'] },
  { num:4, id:'chords',       label:'Chords & Triads',       url:'/learn/music-theory/chords/',       accent:'#f97316', soon:true,
    lessons:['What is a Chord?','Major & Minor Triads','Diminished & Augmented','Seventh Chords','Extended Chords','Voicings & Inversions'] },
  { num:5, id:'keys',         label:'Keys & Circle of Fifths', url:'/learn/music-theory/keys/',       accent:'#c084fc', soon:true,
    lessons:['Key Signatures','The Circle of Fifths','Relative Major & Minor','Parallel Keys'] },
  { num:6, id:'progressions', label:'Chord Progressions',    url:'/learn/music-theory/progressions/', accent:'#fb7185', soon:true,
    lessons:['Roman Numeral Analysis','Diatonic Chords','Common Progressions','Functional Harmony','Modal Interchange'] },
  { num:7, id:'rhythm',       label:'Rhythm & Meter',        url:'/learn/music-theory/rhythm/',       accent:'#a3e635', soon:true,
    lessons:['Note Values','Time Signatures','Ties & Dots','Syncopation','Feel & Groove'] },
  { num:8, id:'notation',     label:'Staff Notation',        url:'/learn/music-theory/notation/',     accent:'#e879f9', soon:true,
    lessons:['The Staff & Clefs','Treble Clef Notes','Bass Clef Notes','Ledger Lines','Note Values & Rests','Time Signatures & Bar Lines'] },
];

// ─────────────────────────────────────────────────────────────
//  SIDEBAR BUILDER
// ─────────────────────────────────────────────────────────────

function buildSidebar(currentUid) {
  // currentUid: e.g. 'mt-notes', 'mt-intervals', 'ae-eq'
  const body = document.getElementById('sidebarBody');
  if (!body) return;

  const aeHTML = AE_COURSES.map(c => _renderCourse(c, 'ae', currentUid)).join('');
  const mtHTML = MT_COURSES.map(c => _renderCourse(c, 'mt', currentUid)).join('');

  body.innerHTML = `
    <div class="sidebar-section">
      <div class="sidebar-section-label">
        <div class="section-dot" style="background:#5b6aff;"></div>Audio Engineering
      </div>
      ${aeHTML}
    </div>
    <div class="sidebar-divider"></div>
    <div class="sidebar-section">
      <div class="sidebar-section-label">
        <div class="section-dot" style="background:#3ecf8e;"></div>Music Theory
      </div>
      ${mtHTML}
    </div>`;
}

function _renderCourse(c, section, currentUid) {
  const uid = `${section}-${c.id}`;
  const isCurrent = uid === currentUid;
  const isOpen = isCurrent;

  const lessons = c.lessons.map((l, i) => {
    if (isCurrent) {
      return `<div class="lesson-row" id="lesson-${uid}-${i}" onclick="jumpToStep(${i})" role="button" tabindex="0">
        <span class="lesson-n">${c.num}.${i+1}</span><span class="lesson-label">${l}</span>
      </div>`;
    } else if (c.soon) {
      return `<div class="lesson-row lesson-soon" aria-disabled="true">
        <span class="lesson-n">${c.num}.${i+1}</span><span class="lesson-label">${l}</span>
      </div>`;
    } else {
      return `<a class="lesson-row" href="${c.url}#${i+1}" style="color:inherit;text-decoration:none;">
        <span class="lesson-n">${c.num}.${i+1}</span><span class="lesson-label">${l}</span>
      </a>`;
    }
  }).join('');

  return `<div class="sidebar-course ${isOpen ? 'is-open' : ''}" id="course-${uid}">
    <div class="course-hdr ${isCurrent ? 'is-active' : ''}"
         onclick="toggleCourse('${uid}', ${isCurrent}, '${c.url}', ${!!c.soon})"
         role="button" tabindex="0" aria-expanded="${isOpen}">
      <span class="course-n">${c.num}.</span>
      <span class="course-label">${c.label}</span>
      ${c.soon ? '<span class="course-soon-badge">Soon</span>' : `<span class="course-chevron">›</span>`}
    </div>
    <div class="course-lessons" id="lessons-${uid}" style="${isOpen ? '' : 'display:none'}">
      ${lessons}
    </div>
  </div>`;
}

function toggleCourse(uid, isCurrent, url, isSoon) {
  const lessonsEl = document.getElementById('lessons-' + uid);
  const courseEl  = document.getElementById('course-' + uid);
  if (!lessonsEl) return;
  const isOpen = lessonsEl.style.display !== 'none';
  if (isOpen) {
    if (!isCurrent) { lessonsEl.style.display = 'none'; courseEl.classList.remove('is-open'); }
  } else {
    lessonsEl.style.display = ''; courseEl.classList.add('is-open');
    if (!isCurrent && !isSoon) window.location.href = url;
  }
}

function updateSidebarActive(idx, uid) {
  document.querySelectorAll(`[id^="lesson-${uid}-"]`).forEach(el => el.classList.remove('is-active'));
  const el = document.getElementById(`lesson-${uid}-${idx}`);
  if (el) { el.classList.add('is-active'); el.scrollIntoView({ block:'nearest', behavior:'smooth' }); }
}

function initMobileSidebar() {
  const sidebar  = document.getElementById('learnSidebar');
  const overlay  = document.getElementById('sidebarOverlay');
  const toggleBtn= document.getElementById('sidebarToggleBtn');
  const closeBtn = document.getElementById('sidebarCloseBtn');
  if (!sidebar) return;

  function openSidebar()  { sidebar.classList.add('is-open'); overlay.classList.add('is-open'); document.body.style.overflow='hidden'; }
  function closeSidebar() { sidebar.classList.remove('is-open'); overlay.classList.remove('is-open'); document.body.style.overflow=''; }
  window.closeSidebar = closeSidebar;

  toggleBtn?.addEventListener('click', openSidebar);
  closeBtn?.addEventListener('click', closeSidebar);
  overlay?.addEventListener('click', closeSidebar);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSidebar();
  });
}

// ─────────────────────────────────────────────────────────────
//  NOTE FREQUENCY TABLE
// ─────────────────────────────────────────────────────────────

const NOTE_FREQ = {
  'C3':130.81,'C#3':138.59,'Db3':138.59,'D3':146.83,'D#3':155.56,'Eb3':155.56,
  'E3':164.81,'F3':174.61,'F#3':185.00,'Gb3':185.00,'G3':196.00,'G#3':207.65,
  'Ab3':207.65,'A3':220.00,'A#3':233.08,'Bb3':233.08,'B3':246.94,
  'C4':261.63,'C#4':277.18,'Db4':277.18,'D4':293.66,'D#4':311.13,'Eb4':311.13,
  'E4':329.63,'F4':349.23,'F#4':369.99,'Gb4':369.99,'G4':392.00,'G#4':415.30,
  'Ab4':415.30,'A4':440.00,'A#4':466.16,'Bb4':466.16,'B4':493.88,
  'C5':523.25,'C#5':554.37,'Db5':554.37,'D5':587.33,'D#5':622.25,'Eb5':622.25,
  'E5':659.25,'F5':698.46,'F#5':739.99,'Gb5':739.99,'G5':783.99,'G#5':830.61,
  'Ab5':830.61,'A5':880.00,'A#5':932.33,'Bb5':932.33,'B5':987.77,
  'C6':1046.50,
};

// ─────────────────────────────────────────────────────────────
//  PIANO KEYBOARD SVG BUILDER
// ─────────────────────────────────────────────────────────────
// opts: { startNote, endNote, highlight, accent }
// highlight: array of note names e.g. ['C4','E4','G4']
// accent: CSS color for highlighted keys

const _WK_W = 32;   // white key width
const _WK_H = 88;   // white key height
const _WK_G = 1.5;  // gap between white keys
const _BK_W = 20;   // black key width
const _BK_H = 54;   // black key height

// White note → index within octave
const _WHITE_IDX = { C:0, D:1, E:2, F:3, G:4, A:5, B:6 };

// Black key offset (fractional white-key-widths from the white key it follows)
const _BLACK_OFFSET = {
  'C#':0.62,'Db':0.62,
  'D#':1.62,'Eb':1.62,
  'F#':3.62,'Gb':3.62,
  'G#':4.62,'Ab':4.62,
  'A#':5.62,'Bb':5.62,
};

function _isBlack(noteName) {
  const n = noteName.replace(/\d/g,'');
  return n.includes('#') || n.includes('b');
}

function _noteOctave(noteName) {
  const m = noteName.match(/(\d+)$/);
  return m ? parseInt(m[1]) : 4;
}

function _noteLetter(noteName) {
  return noteName.replace(/\d/g,'');
}

// Build sorted list of all notes in range
function _notesInRange(startNote, endNote) {
  const chromatic = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const result = [];
  let startIdx = chromatic.indexOf(_noteLetter(startNote).replace('b','').replace('Db','C#').replace('Eb','D#').replace('Gb','F#').replace('Ab','G#').replace('Bb','A#'));
  let oct = _noteOctave(startNote);
  const endFreq = NOTE_FREQ[endNote] || 1046.50;
  for (let iter = 0; iter < 200; iter++) {
    const letter = chromatic[startIdx % 12];
    const name = letter + oct;
    const freq = NOTE_FREQ[name];
    if (!freq || freq > endFreq + 1) break;
    result.push(name);
    startIdx++;
    if (startIdx % 12 === 0) oct++;
  }
  return result;
}

function buildPianoSVG({ startNote='C4', endNote='C5', highlight=[], accent='#3ecf8e', showLabels=true } = {}) {
  const chromatic = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const STEP = _WK_W + _WK_G;
  const hlSet = new Set(highlight);

  // Build white key list
  const whiteKeys = [];
  const blackKeys = [];
  let startIdx = chromatic.indexOf('C');
  let oct = _noteOctave(startNote);
  let wkCount = 0;

  // Start from start note
  const startLetter = _noteLetter(startNote);
  startIdx = chromatic.indexOf(startLetter);
  if (startIdx < 0) startIdx = 0;

  const endFreq = (NOTE_FREQ[endNote] || NOTE_FREQ['C5']) + 1;

  // Count white keys from startNote to endNote
  for (let iter = 0; iter < 200; iter++) {
    const letter = chromatic[startIdx % 12];
    const name = letter + oct;
    const freq = NOTE_FREQ[name];
    if (!freq || freq > endFreq) break;
    const isB = letter.includes('#');
    if (!isB) { whiteKeys.push({ name, letter, oct, wkIdx: wkCount }); wkCount++; }
    else { blackKeys.push({ name, letter, oct }); }
    startIdx++;
    if (startIdx % 12 === 0) oct++;
  }

  const svgW = wkCount * STEP - _WK_G + 2; // +2 for stroke
  const svgH = _WK_H + (showLabels ? 22 : 6);

  // White key rects
  let whiteSVG = '';
  whiteKeys.forEach(k => {
    const x = k.wkIdx * STEP + 0.5;
    const isHL = hlSet.has(k.name);
    const fill = isHL ? accent : '#f5f5f5';
    const stroke = isHL ? accent : '#ccc';
    whiteSVG += `<rect x="${x}" y="0.5" width="${_WK_W}" height="${_WK_H}" rx="3" ry="3"
      fill="${fill}" stroke="${stroke}" stroke-width="${isHL?1.5:1}"/>`;
    if (showLabels && k.letter === 'C') {
      const labelColor = isHL ? '#fff' : '#aaa';
      whiteSVG += `<text x="${x + _WK_W/2}" y="${_WK_H + 14}" text-anchor="middle"
        font-family="IBM Plex Mono,monospace" font-size="9" font-weight="600" fill="${labelColor}">${k.name}</text>`;
    }
    if (isHL) {
      // Dot indicator
      whiteSVG += `<circle cx="${x + _WK_W/2}" cy="${_WK_H - 12}" r="4" fill="${accent}" opacity="0.9"/>`;
    }
  });

  // Black key rects (draw on top)
  let blackSVG = '';
  // Need to know the white key index for each octave start
  blackKeys.forEach(k => {
    const letter = k.letter; // e.g. 'C#'
    const oct = k.oct;
    const offset = _BLACK_OFFSET[letter] ?? 0;
    // Find the octave's C white key index
    const cKey = whiteKeys.find(w => w.letter==='C' && w.oct===oct);
    if (!cKey) return;
    const x = (cKey.wkIdx + offset) * STEP - _BK_W/2 + 0.5;
    const isHL = hlSet.has(k.name);
    const fill = isHL ? accent : '#222';
    blackSVG += `<rect x="${x}" y="0.5" width="${_BK_W}" height="${_BK_H}" rx="2" ry="2"
      fill="${fill}" stroke="${isHL?accent:'#111'}" stroke-width="${isHL?1.5:0.5}"/>`;
    if (isHL) {
      blackSVG += `<circle cx="${x + _BK_W/2}" cy="${_BK_H - 8}" r="3.5" fill="rgba(255,255,255,0.9)"/>`;
    }
  });

  return `<svg viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg"
    style="width:100%;max-width:${svgW}px;height:auto;display:block;overflow:visible;">
    ${whiteSVG}
    ${blackSVG}
  </svg>`;
}

// ─────────────────────────────────────────────────────────────
//  AUDIO SYNTHESIS — Music Theory
// ─────────────────────────────────────────────────────────────

let _mtCtx = null;
let _mtNodes = [];
let _mtPlaying = false;
let _mtStopTimer = null;

function mtGetCtx() {
  if (!_mtCtx) _mtCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (_mtCtx.state === 'suspended') _mtCtx.resume();
  return _mtCtx;
}

function mtStop() {
  _mtNodes.forEach(n => { try { n.stop(0); } catch(e){} });
  clearTimeout(_mtStopTimer);
  _mtNodes = [];
  _mtPlaying = false;
  const btn = document.querySelector('.play-btn');
  if (btn) {
    btn.classList.remove('playing');
    btn.querySelector('.play-icon').style.display = '';
    btn.querySelector('.stop-icon').style.display = 'none';
  }
}

// Synthesize a piano-like tone (triangle + detuned sine for warmth)
function _mtPlayNote(freq, startTime, duration, ctx, master) {
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, startTime);
  env.gain.linearRampToValueAtTime(0.7, startTime + 0.012);
  env.gain.exponentialRampToValueAtTime(0.3, startTime + 0.18);
  env.gain.setValueAtTime(0.3, startTime + duration - 0.08);
  env.gain.linearRampToValueAtTime(0, startTime + duration);
  env.connect(master);

  const osc1 = ctx.createOscillator();
  osc1.type = 'triangle';
  osc1.frequency.value = freq;

  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = freq * 2.002; // slight detune for warmth

  const g2 = ctx.createGain(); g2.gain.value = 0.25;
  osc2.connect(g2); g2.connect(env);
  osc1.connect(env);

  osc1.start(startTime); osc1.stop(startTime + duration);
  osc2.start(startTime); osc2.stop(startTime + duration);
  _mtNodes.push(osc1, osc2);
}

// Play a sequence of notes
function mtPlaySeq(noteNames, noteDur = 0.45, gap = 0.0) {
  const ctx = mtGetCtx();
  mtStop();
  _mtPlaying = true;

  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.35;
  masterGain.connect(ctx.destination);

  let t = ctx.currentTime + 0.05;
  noteNames.forEach(name => {
    const freq = NOTE_FREQ[name];
    if (!freq) { t += noteDur + gap; return; }
    _mtPlayNote(freq, t, noteDur, ctx, masterGain);
    t += noteDur + gap;
  });

  const totalTime = noteNames.length * (noteDur + gap) + 0.3;
  _mtStopTimer = setTimeout(() => {
    _mtPlaying = false;
    const btn = document.querySelector('.play-btn');
    if (btn) {
      btn.classList.remove('playing');
      btn.querySelector('.play-icon').style.display = '';
      btn.querySelector('.stop-icon').style.display = 'none';
    }
  }, totalTime * 1000);

  const btn = document.querySelector('.play-btn');
  if (btn) {
    btn.classList.add('playing');
    btn.querySelector('.play-icon').style.display = 'none';
    btn.querySelector('.stop-icon').style.display = '';
  }
}

// Play notes simultaneously (chord)
function mtPlayChord(noteNames, duration = 2.2) {
  const ctx = mtGetCtx();
  mtStop();
  _mtPlaying = true;

  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.28;
  masterGain.connect(ctx.destination);

  const t = ctx.currentTime + 0.05;
  noteNames.forEach(name => {
    const freq = NOTE_FREQ[name];
    if (freq) _mtPlayNote(freq, t, duration, ctx, masterGain);
  });

  _mtStopTimer = setTimeout(() => {
    _mtPlaying = false;
    const btn = document.querySelector('.play-btn');
    if (btn) {
      btn.classList.remove('playing');
      btn.querySelector('.play-icon').style.display = '';
      btn.querySelector('.stop-icon').style.display = 'none';
    }
  }, (duration + 0.4) * 1000);

  const btn = document.querySelector('.play-btn');
  if (btn) {
    btn.classList.add('playing');
    btn.querySelector('.play-icon').style.display = 'none';
    btn.querySelector('.stop-icon').style.display = '';
  }
}

// Play sequence then chord (used for scale → chord demos)
function mtPlaySeqThenChord(seqNotes, chordNotes, noteDur = 0.38, gap = 0.0, chordDur = 1.8) {
  const ctx = mtGetCtx();
  mtStop();
  _mtPlaying = true;

  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.32;
  masterGain.connect(ctx.destination);

  let t = ctx.currentTime + 0.05;
  seqNotes.forEach(name => {
    const freq = NOTE_FREQ[name];
    if (freq) _mtPlayNote(freq, t, noteDur * 0.95, ctx, masterGain);
    t += noteDur + gap;
  });
  t += 0.1;
  chordNotes.forEach(name => {
    const freq = NOTE_FREQ[name];
    if (freq) _mtPlayNote(freq, t, chordDur, ctx, masterGain);
  });

  const totalTime = seqNotes.length * (noteDur + gap) + chordDur + 0.6;
  _mtStopTimer = setTimeout(() => {
    _mtPlaying = false;
    const btn = document.querySelector('.play-btn');
    if (btn) {
      btn.classList.remove('playing');
      btn.querySelector('.play-icon').style.display = '';
      btn.querySelector('.stop-icon').style.display = 'none';
    }
  }, totalTime * 1000);

  const btn = document.querySelector('.play-btn');
  if (btn) {
    btn.classList.add('playing');
    btn.querySelector('.play-icon').style.display = 'none';
    btn.querySelector('.stop-icon').style.display = '';
  }
}

function mtTogglePlay(fn) {
  if (_mtPlaying) { mtStop(); return; }
  fn();
}
