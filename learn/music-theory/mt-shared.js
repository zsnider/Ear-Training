// ─────────────────────────────────────────────────────────────
//  SonicSandbox — Music Theory Shared Utilities
//  Provides: sidebar data + renderer, piano SVG builder,
//            note frequencies, audio (grand piano sample + osc fallback).
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
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSidebar(); });
}

// ─────────────────────────────────────────────────────────────
//  NOTE FREQUENCY TABLE
// ─────────────────────────────────────────────────────────────

const NOTE_FREQ = {
  'C2':65.41,'C#2':69.30,'Db2':69.30,'D2':73.42,'D#2':77.78,'Eb2':77.78,
  'E2':82.41,'F2':87.31,'F#2':92.50,'Gb2':92.50,'G2':98.00,'G#2':103.83,
  'Ab2':103.83,'A2':110.00,'A#2':116.54,'Bb2':116.54,'B2':123.47,
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
// opts: { startNote, endNote, highlight, accent, showLabels }

const _WK_W = 42;    // white key width
const _WK_H = 112;   // white key height
const _WK_G = 2;     // gap between white keys
const _BK_W = 26;    // black key width
const _BK_H = 68;    // black key height

const _WHITE_IDX = { C:0, D:1, E:2, F:3, G:4, A:5, B:6 };

// Black key offset in fractional white-key-widths from octave C
const _BLACK_OFFSET = {
  'C#':0.62,'Db':0.62,
  'D#':1.62,'Eb':1.62,
  'F#':3.62,'Gb':3.62,
  'G#':4.62,'Ab':4.62,
  'A#':5.62,'Bb':5.62,
};

function _isBlack(noteName) {
  const n = noteName.replace(/\d/g,'');
  return n.includes('#') || (n.length === 2 && n.includes('b'));
}

function _noteOctave(noteName) {
  const m = noteName.match(/(\d+)$/);
  return m ? parseInt(m[1]) : 4;
}

function _noteLetter(noteName) {
  return noteName.replace(/\d/g,'');
}

function buildPianoSVG({ startNote='C4', endNote='C5', highlight=[], accent='#3ecf8e', showLabels=true } = {}) {
  const chromatic = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const STEP = _WK_W + _WK_G;
  const hlSet = new Set(highlight);

  const whiteKeys = [];
  const blackKeys = [];
  let startIdx = chromatic.indexOf(_noteLetter(startNote));
  if (startIdx < 0) startIdx = 0;
  let oct = _noteOctave(startNote);
  let wkCount = 0;

  const endFreq = (NOTE_FREQ[endNote] || NOTE_FREQ['C5']) + 1;

  for (let iter = 0; iter < 200; iter++) {
    const letter = chromatic[startIdx % 12];
    const name   = letter + oct;
    const freq   = NOTE_FREQ[name];
    if (!freq || freq > endFreq) break;
    const isB = letter.includes('#');
    if (!isB) { whiteKeys.push({ name, letter, oct, wkIdx: wkCount }); wkCount++; }
    else       { blackKeys.push({ name, letter, oct }); }
    startIdx++;
    if (startIdx % 12 === 0) oct++;
  }

  const svgW = wkCount * STEP - _WK_G + 4; // +4 padding for outer border
  const svgH = _WK_H + (showLabels ? 24 : 8) + 4;

  // Piano body background
  let svg = `<rect x="1" y="1" width="${svgW-2}" height="${_WK_H + 2}" rx="6" ry="6"
    fill="#161618" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>`;

  // White keys
  let whiteSVG = '';
  whiteKeys.forEach(k => {
    const x = k.wkIdx * STEP + 2; // +2 offset for body padding
    const isHL = hlSet.has(k.name);
    const fill   = isHL ? accent : '#efefef';
    const stroke = isHL ? 'rgba(0,0,0,0.3)' : '#b0b0b0';
    whiteSVG += `<rect x="${x}" y="2" width="${_WK_W}" height="${_WK_H}" rx="3" ry="3"
      fill="${fill}" stroke="${stroke}" stroke-width="1"/>`;
    if (isHL) {
      // Filled dot at the bottom of the key
      whiteSVG += `<circle cx="${x + _WK_W/2}" cy="${_WK_H - 14}" r="5" fill="rgba(0,0,0,0.22)"/>`;
    }
    if (showLabels && k.letter === 'C') {
      const labelColor = isHL ? 'rgba(0,0,0,0.5)' : '#999';
      whiteSVG += `<text x="${x + _WK_W/2}" y="${_WK_H + 20}" text-anchor="middle"
        font-family="IBM Plex Mono,monospace" font-size="10" font-weight="600" fill="${labelColor}">${k.name}</text>`;
    }
  });

  // Black keys — drawn on top; always have a visible border in both states
  let blackSVG = '';
  blackKeys.forEach(k => {
    const letter = k.letter;
    const oct    = k.oct;
    const offset = _BLACK_OFFSET[letter] ?? 0;
    const cKey   = whiteKeys.find(w => w.letter==='C' && w.oct===oct);
    if (!cKey) return;
    const x    = (cKey.wkIdx + offset) * STEP - _BK_W/2 + 2;
    const isHL = hlSet.has(k.name);

    if (isHL) {
      // Highlighted: accent fill with dark border so it reads against white keys
      blackSVG += `<rect x="${x}" y="2" width="${_BK_W}" height="${_BK_H}" rx="3" ry="3"
        fill="${accent}" stroke="rgba(0,0,0,0.45)" stroke-width="1.5"/>`;
      // White dot near bottom
      blackSVG += `<circle cx="${x + _BK_W/2}" cy="${_BK_H - 10}" r="4" fill="rgba(0,0,0,0.28)"/>`;
    } else {
      // Not highlighted: dark fill with subtle light border so it reads against dark bg
      blackSVG += `<rect x="${x}" y="2" width="${_BK_W}" height="${_BK_H}" rx="3" ry="3"
        fill="#1a1a1e" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>`;
    }
  });

  return `<svg viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg"
    style="width:100%;max-width:${svgW}px;height:auto;display:block;overflow:visible;">
    ${svg}
    ${whiteSVG}
    ${blackSVG}
  </svg>`;
}

// ─────────────────────────────────────────────────────────────
//  AUDIO ENGINE — Grand Piano Sample + Oscillator Fallback
// ─────────────────────────────────────────────────────────────

let _mtCtx          = null;
let _mtNodes        = [];
let _mtPlaying      = false;
let _mtStopTimer    = null;
let _mtPianoAB      = null;   // raw ArrayBuffer from fetch
let _mtPianoBuffer  = null;   // decoded AudioBuffer (set after first user gesture)
const _MT_SAMPLE    = '/learn/music-theory/samples/piano-c3.wav';
const _MT_C3_MIDI   = 48;     // the sample is tuned to C3

// Fetch the sample file immediately (no AudioContext needed for fetch)
(async function _mtFetchPiano() {
  try {
    const r = await fetch(_MT_SAMPLE);
    if (r.ok) _mtPianoAB = await r.arrayBuffer();
  } catch(e) {
    console.warn('[MT] Piano sample fetch failed — oscillator fallback active', e);
  }
})();

function mtGetCtx() {
  if (!_mtCtx) {
    _mtCtx = new (window.AudioContext || window.webkitAudioContext)();
    // Decode the sample now that we have a context (triggered by user gesture)
    if (_mtPianoAB && !_mtPianoBuffer) {
      _mtCtx.decodeAudioData(
        _mtPianoAB.slice(0), // slice so the buffer isn't detached
        buf  => { _mtPianoBuffer = buf; },
        err  => { console.warn('[MT] Piano sample decode failed', err); }
      );
    }
  }
  if (_mtCtx.state === 'suspended') _mtCtx.resume();
  return _mtCtx;
}

function _mtSetPlayBtn(isPlaying) {
  const btn = document.querySelector('.play-btn');
  if (!btn) return;
  btn.classList.toggle('playing', isPlaying);
  btn.querySelector('.play-icon').style.display = isPlaying ? 'none' : '';
  btn.querySelector('.stop-icon').style.display = isPlaying ? '' : 'none';
}

function mtStop() {
  _mtNodes.forEach(n => { try { n.stop(0); } catch(e){} });
  clearTimeout(_mtStopTimer);
  _mtNodes    = [];
  _mtPlaying  = false;
  _mtSetPlayBtn(false);
}

// ── Note playback ────────────────────────────────────────────

function _mtPlayNote(freq, startTime, duration, ctx, master) {
  if (_mtPianoBuffer) {
    // ── Sample-based playback ────────────────────────────
    const semitones = Math.round(69 + 12 * Math.log2(freq / 440)) - _MT_C3_MIDI;
    const rate      = Math.pow(2, semitones / 12);
    const maxDur    = (_mtPianoBuffer.duration / rate) * 0.96;
    const playDur   = Math.min(duration, maxDur);
    const fadeLen   = Math.min(0.20, playDur * 0.12);

    const src = ctx.createBufferSource();
    src.buffer = _mtPianoBuffer;
    src.playbackRate.value = rate;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.88, startTime);
    env.gain.setValueAtTime(0.88, startTime + playDur - fadeLen);
    env.gain.linearRampToValueAtTime(0, startTime + playDur);

    src.connect(env);
    env.connect(master);
    src.start(startTime);
    src.stop(startTime + playDur + 0.06);
    _mtNodes.push(src);
  } else {
    // ── Oscillator fallback ──────────────────────────────
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const osc3 = ctx.createOscillator();
    osc1.type = 'triangle';  osc1.frequency.value = freq;
    osc2.type = 'sawtooth';  osc2.frequency.value = freq * 1.0019;
    osc3.type = 'triangle';  osc3.frequency.value = freq * 2.001;

    const g1 = ctx.createGain(); g1.gain.value = 0.52;
    const g2 = ctx.createGain(); g2.gain.value = 0.08;
    const g3 = ctx.createGain(); g3.gain.value = 0.04;

    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = Math.min(4500, 900 + (Math.round(69 + 12 * Math.log2(freq/440)) - 48) * 65);
    flt.Q.value = 0.4;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, startTime);
    env.gain.linearRampToValueAtTime(0.42, startTime + 0.008);
    env.gain.exponentialRampToValueAtTime(0.20, startTime + 0.22);
    env.gain.setValueAtTime(0.20, startTime + duration - 0.10);
    env.gain.linearRampToValueAtTime(0, startTime + duration);

    osc1.connect(g1); osc2.connect(g2); osc3.connect(g3);
    g1.connect(flt); g2.connect(flt); g3.connect(flt);
    flt.connect(env); env.connect(master);

    const stopT = startTime + duration + 0.06;
    osc1.start(startTime); osc1.stop(stopT);
    osc2.start(startTime); osc2.stop(stopT);
    osc3.start(startTime); osc3.stop(stopT);
    _mtNodes.push(osc1, osc2, osc3);
  }
}

// ── Public play helpers ──────────────────────────────────────

function mtPlaySeq(noteNames, noteDur = 0.45, gap = 0.0) {
  const ctx = mtGetCtx();
  mtStop();
  _mtPlaying = true;
  _mtSetPlayBtn(true);

  const master = ctx.createGain();
  master.gain.value = _mtPianoBuffer ? 0.72 : 0.35;
  master.connect(ctx.destination);

  let t = ctx.currentTime + 0.05;
  noteNames.forEach(name => {
    const freq = NOTE_FREQ[name];
    if (!freq) { t += noteDur + gap; return; }
    _mtPlayNote(freq, t, noteDur, ctx, master);
    t += noteDur + gap;
  });

  _mtStopTimer = setTimeout(() => {
    _mtPlaying = false;
    _mtSetPlayBtn(false);
  }, (noteNames.length * (noteDur + gap) + 0.4) * 1000);
}

function mtPlayChord(noteNames, duration = 2.2) {
  const ctx = mtGetCtx();
  mtStop();
  _mtPlaying = true;
  _mtSetPlayBtn(true);

  const master = ctx.createGain();
  master.gain.value = _mtPianoBuffer ? 0.60 : 0.28;
  master.connect(ctx.destination);

  const t = ctx.currentTime + 0.05;
  noteNames.forEach(name => {
    const freq = NOTE_FREQ[name];
    if (freq) _mtPlayNote(freq, t, duration, ctx, master);
  });

  _mtStopTimer = setTimeout(() => {
    _mtPlaying = false;
    _mtSetPlayBtn(false);
  }, (duration + 0.4) * 1000);
}

function mtPlaySeqThenChord(seqNotes, chordNotes, noteDur = 0.38, gap = 0.0, chordDur = 1.8) {
  const ctx = mtGetCtx();
  mtStop();
  _mtPlaying = true;
  _mtSetPlayBtn(true);

  const master = ctx.createGain();
  master.gain.value = _mtPianoBuffer ? 0.68 : 0.32;
  master.connect(ctx.destination);

  let t = ctx.currentTime + 0.05;
  seqNotes.forEach(name => {
    const freq = NOTE_FREQ[name];
    if (freq) _mtPlayNote(freq, t, noteDur * 0.95, ctx, master);
    t += noteDur + gap;
  });
  t += 0.10;
  chordNotes.forEach(name => {
    const freq = NOTE_FREQ[name];
    if (freq) _mtPlayNote(freq, t, chordDur, ctx, master);
  });

  _mtStopTimer = setTimeout(() => {
    _mtPlaying = false;
    _mtSetPlayBtn(false);
  }, (seqNotes.length * (noteDur + gap) + chordDur + 0.6) * 1000);
}

function mtTogglePlay(fn) {
  if (_mtPlaying) { mtStop(); return; }
  fn();
}
