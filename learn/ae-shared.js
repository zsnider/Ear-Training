// ─────────────────────────────────────────────────────────────
//  SonicSandbox — Audio Engineering Shared Sidebar Utilities
//  Provides: sidebar data + renderer, mobile sidebar init,
//            lesson active-state updater.
//
//  Each AE module page must call:
//    buildSidebar('gain-staging')   ← pass the current course id
//    initMobileSidebar()
// ─────────────────────────────────────────────────────────────

const AE_COURSES = [
  { num:1,  id:'eq',           label:'EQ',               url:'/learn/',               accent:'#5b6aff', accent2:'#8892ff',
    lessons:['What is EQ?','The Frequency Spectrum','Sub Bass — 20 to 60 Hz','Bass — 60 to 250 Hz','Low Mids — 250 to 500 Hz','Midrange — 500 Hz to 2 kHz','High Mids — 2 to 6 kHz','Presence & Air — 6 to 20 kHz','EQ Filter Types','Practical EQ Tips'] },
  { num:2,  id:'gain-staging', label:'Gain Staging',      url:'/learn/gain-staging/',  accent:'#86efac', accent2:'#a7f3d0',
    lessons:['What Is Gain Staging?','Decibels — The Language of Loudness','Clipping — When Signal Goes Too Hot','Headroom — Give Transients Room','How Gain Accumulates Through a Chain','Reading Meters — Peak, RMS, LUFS','The −18 dBFS Target','Input, Output & Gain Compensation','Gain Staging the Mix Bus'] },
  { num:3,  id:'compression',  label:'Compression',       url:'/learn/compression/',   accent:'#e8865a', accent2:'#f0a882',
    lessons:['What is Compression?','How Compression Works','Threshold','Ratio','Attack','Release','Knee','Makeup Gain','Compressor Types','Parallel Compression','Sidechain Compression','Practical Tips'] },
  { num:4,  id:'saturation',   label:'Saturation',        url:'/learn/saturation/',    accent:'#fbbf24', accent2:'#fde68a',
    lessons:['What is Saturation?','Even vs Odd Harmonics','Soft vs Hard Clipping','Drive','Tape Saturation','Tube Saturation','Transistor & Digital Clipping','Parallel Saturation','Where to Use Saturation','Practical Workflow'] },
  { num:5,  id:'reverb',       label:'Reverb',            url:'/learn/reverb/',        accent:'#a78bfa', accent2:'#c4b5fd',
    lessons:['What is Reverb?','Direct Sound & Early Reflections','Wet/Dry Balance','Pre-delay','Decay Time','Room Reverb','Hall Reverb','Plate & Spring','Diffusion & Damping','Reverb in the Mix'] },
  { num:6,  id:'delay',        label:'Delay',             url:'/learn/delay/',         accent:'#f97316', accent2:'#fb923c',
    lessons:['What is Delay?','Feedback & Repeats','Delay Time & Tempo Sync','Tape Delay','Analog Delay','Digital Delay & Ping-Pong','Modulation in Delay','The Haas Effect','Where to Use Delay','Practical Workflow'] },
  { num:7,  id:'soundstage',   label:'Spatial Mixing',    url:'/learn/soundstage/',    accent:'#38bdf8', accent2:'#7dd3fc',
    lessons:['Spatial Mixing','The Three Axes','Left & Right — Panning','Front & Back — Depth','Up & Down — Frequency as Height','Width — Mono vs Stereo','Reverb as Depth','Conventional Placement','Creating Space','Building Your Soundstage'] },
  { num:8,  id:'signal-chain', label:'Signal Chain',      url:'/learn/signal-chain/',  accent:'#22d3ee', accent2:'#67e8f9',
    lessons:['What Is a Signal Chain?','Why Order Matters','Gate & Expander','EQ → Compression','Compression Before Saturation','Inserts vs Sends','Time-Based Effects Last','The Master Bus Chain','Signal Chain Templates'] },
  { num:9,  id:'modulation',   label:'Modulation',        url:'/learn/modulation/',    accent:'#34d399', accent2:'#6ee7b7',
    lessons:['What is Modulation?','The LFO — Rate & Depth','Chorus','Flanger','Phaser','Tremolo','Vibrato','Telling Them Apart','Modulation in the Mix','Practical Workflow'] },
  { num:10, id:'limiting',     label:'Limiting',          url:'/learn/limiting/',      accent:'#fda4af', accent2:'#fecdd3',
    lessons:['What is a Limiter?','Ceiling, Threshold & Input Gain','Brickwall vs Dynamics Limiters','Release Time & Artifacts','LUFS in Depth','Streaming Normalization','True Peak','Practical Workflow'] },
];

const MT_COURSES = [
  { num:1, id:'notes',        label:'Notes & The Piano',       url:'/learn/music-theory/notes/',        accent:'#3ecf8e',
    lessons:['The 12 Notes','Sharps, Flats & Enharmonics','The Piano Keyboard','Octaves & Pitch Registers'] },
  { num:2, id:'intervals',    label:'Intervals',               url:'/learn/music-theory/intervals/',    accent:'#60e8ff',
    lessons:['Half Steps & Whole Steps','Naming Intervals','Perfect Intervals','Major & Minor Intervals','Augmented & Diminished'] },
  { num:3, id:'scales',       label:'Scales',                  url:'/learn/music-theory/scales/',       accent:'#fbbf24',
    lessons:['The Major Scale','Natural Minor Scale','Harmonic & Melodic Minor','Pentatonic Scales','The Blues Scale','Modes'] },
  { num:4, id:'chords',       label:'Chords & Triads',         url:'/learn/music-theory/chords/',       accent:'#f97316',
    lessons:['What is a Chord?','Major & Minor Triads','Diminished & Augmented','Seventh Chords','Extended Chords','Voicings & Inversions'] },
  { num:5, id:'keys',         label:'Keys & Circle of Fifths', url:'/learn/music-theory/keys/',         accent:'#c084fc', soon:true,
    lessons:['Key Signatures','The Circle of Fifths','Relative Major & Minor','Parallel Keys'] },
  { num:6, id:'progressions', label:'Chord Progressions',      url:'/learn/music-theory/progressions/', accent:'#fb7185', soon:true,
    lessons:['Roman Numeral Analysis','Diatonic Chords','Common Progressions','Functional Harmony','Modal Interchange'] },
  { num:7, id:'rhythm',       label:'Rhythm & Meter',          url:'/learn/music-theory/rhythm/',       accent:'#a3e635', soon:true,
    lessons:['Note Values','Time Signatures','Ties & Dots','Syncopation','Feel & Groove'] },
  { num:8, id:'notation',     label:'Staff Notation',          url:'/learn/music-theory/notation/',     accent:'#e879f9', soon:true,
    lessons:['The Staff & Clefs','Treble Clef Notes','Bass Clef Notes','Ledger Lines','Note Values & Rests','Time Signatures & Bar Lines'] },
];

// ─────────────────────────────────────────────────────────────
//  SIDEBAR BUILDER
// ─────────────────────────────────────────────────────────────

function buildSidebar(courseId) {
  const body = document.getElementById('sidebarBody');
  if (!body) return;

  // Inject per-course accent CSS variable
  const cur = AE_COURSES.find(c => c.id === courseId);
  if (cur) {
    const style = document.createElement('style');
    style.textContent = `
      :root { --learn-accent: ${cur.accent}; --learn-accent2: ${cur.accent2}; }
      .lesson-row.is-active { border-left-color: ${cur.accent} !important; }
      .lesson-row.is-active .lesson-n { color: ${cur.accent} !important; }
    `;
    document.head.appendChild(style);
  }

  const aeHTML = AE_COURSES.map(c => _renderCourse(c, 'ae', courseId)).join('');
  const mtHTML = MT_COURSES.map(c => _renderCourse(c, 'mt', courseId)).join('');

  body.innerHTML = `
    <div class="sidebar-section">
      <div class="sidebar-section-label">
        <div class="section-dot" style="background:#5b6aff;"></div>
        Audio Engineering
      </div>
      ${aeHTML}
    </div>
    <div class="sidebar-divider"></div>
    <div class="sidebar-section">
      <div class="sidebar-section-label">
        <div class="section-dot" style="background:#3ecf8e;"></div>
        Music Theory
      </div>
      ${mtHTML}
    </div>
  `;

  // Open current course
  const curEl = document.getElementById(`ae-course-${courseId}`);
  if (curEl) {
    curEl.classList.add('is-open');
    const lessons = document.getElementById(`ae-lessons-${courseId}`);
    if (lessons) lessons.style.display = '';
  }
}

function _renderCourse(c, section, activeCourseId) {
  const uid = `${section}-${c.id}`;
  const isCurrent = (section === 'ae' && c.id === activeCourseId);
  const isOpen = isCurrent;

  const lessonsHTML = c.lessons.map((l, i) => {
    if (isCurrent) {
      return `<div class="lesson-row" id="${uid}-lesson-${i}" onclick="goToStep(${i})" role="button" tabindex="0">
        <span class="lesson-n">${c.num}.${i + 1}</span>
        <span class="lesson-label">${l}</span>
      </div>`;
    } else if (c.soon) {
      return `<div class="lesson-row lesson-soon" aria-disabled="true">
        <span class="lesson-n">${c.num}.${i + 1}</span>
        <span class="lesson-label">${l}</span>
      </div>`;
    } else {
      return `<a class="lesson-row" href="${c.url}#${i + 1}" style="color:inherit;">
        <span class="lesson-n">${c.num}.${i + 1}</span>
        <span class="lesson-label">${l}</span>
      </a>`;
    }
  }).join('');

  return `
    <div class="sidebar-course ${isOpen ? 'is-open' : ''}" id="${section}-course-${c.id}">
      <div class="course-hdr ${isCurrent ? 'is-active' : ''}"
           onclick="_toggleCourse('${uid}', ${isCurrent}, '${c.url}', ${!!c.soon})"
           role="button" tabindex="0" aria-expanded="${isOpen}">
        <span class="course-n">${c.num}.</span>
        <span class="course-label">${c.label}</span>
        ${c.soon ? '<span class="course-soon-badge">Soon</span>' : `<span class="course-chevron">›</span>`}
      </div>
      <div class="course-lessons" id="${uid}-lessons" style="${isOpen ? '' : 'display:none'}">
        ${lessonsHTML}
      </div>
    </div>
  `;
}

function _toggleCourse(uid, isCurrent, url, isSoon) {
  const lessonsEl = document.getElementById(uid + '-lessons');
  const courseEl  = document.getElementById(uid.replace('-', '-course-'));
  if (!lessonsEl) return;
  const isOpen = lessonsEl.style.display !== 'none';
  if (isOpen) {
    if (!isCurrent) { lessonsEl.style.display = 'none'; courseEl?.classList.remove('is-open'); }
  } else {
    lessonsEl.style.display = '';
    courseEl?.classList.add('is-open');
    if (!isCurrent && !isSoon) window.location.href = url;
  }
}

// Update which lesson row is highlighted as active
function updateSidebarActive(stepIdx, courseId) {
  document.querySelectorAll(`[id^="ae-${courseId}-lesson-"]`).forEach(el => el.classList.remove('is-active'));
  const el = document.getElementById(`ae-${courseId}-lesson-${stepIdx}`);
  if (el) {
    el.classList.add('is-active');
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

// Mobile sidebar behavior
function initMobileSidebar() {
  const sidebar  = document.getElementById('learnSidebar');
  const overlay  = document.getElementById('sidebarOverlay');
  const toggleBtn= document.getElementById('sidebarToggleBtn');
  const closeBtn = document.getElementById('sidebarCloseBtn');

  function openSidebar()  { sidebar?.classList.add('is-open');    overlay?.classList.add('is-open'); }
  function closeSidebar() { sidebar?.classList.remove('is-open'); overlay?.classList.remove('is-open'); }

  toggleBtn?.addEventListener('click', openSidebar);
  closeBtn?.addEventListener('click', closeSidebar);
  overlay?.addEventListener('click', closeSidebar);
}
