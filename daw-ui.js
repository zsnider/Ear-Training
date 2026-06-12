/*
 * SonicSandbox — DAW UI shared JS
 * ===============================
 * Renderers shared across the effect games. Pure-visual: they take an
 * already-computed angle / colour, so each game keeps its own param math.
 *
 * Requires the #knobCap / #knobCapLocked <defs> gradients in the page
 * (see the inline SVG injected after <body>).
 */

/* Rotary knob with value arc, tactile cap, pointer notch, glowing tip.
 * angle: -135 (min) .. 135 (max). color: any CSS colour. */
function makeProKnobSVG(angle, color, isLocked) {
  const cx = 44, cy = 44, rArc = 38, rCap = 26;
  const START = -135, END = 135;
  const toRad = a => (a - 90) * Math.PI / 180;
  const ax = (a, rr) => cx + rr * Math.cos(toRad(a));
  const ay = (a, rr) => cy + rr * Math.sin(toRad(a));

  const trackPath = `M ${ax(START,rArc)} ${ay(START,rArc)} A ${rArc} ${rArc} 0 1 1 ${ax(END,rArc)} ${ay(END,rArc)}`;
  const large = (angle - START) > 180 ? 1 : 0;
  const valPath = `M ${ax(START,rArc)} ${ay(START,rArc)} A ${rArc} ${rArc} 0 ${large} 1 ${ax(angle,rArc)} ${ay(angle,rArc)}`;

  const pIn = rCap - 13, pOut = rCap - 2;
  const nx1 = cx + pIn  * Math.cos(toRad(angle)), ny1 = cy + pIn  * Math.sin(toRad(angle));
  const nx2 = cx + pOut * Math.cos(toRad(angle)), ny2 = cy + pOut * Math.sin(toRad(angle));
  const tipx = ax(angle, rArc), tipy = ay(angle, rArc);

  const arcColor = isLocked ? 'rgba(255,255,255,0.16)' : color;
  const capFill  = isLocked ? 'url(#knobCapLocked)' : 'url(#knobCap)';
  const glow     = isLocked ? '' : `filter:drop-shadow(0 0 4px ${color});`;

  return `<svg class="knob-svg" viewBox="0 0 88 88" xmlns="http://www.w3.org/2000/svg">
    <path d="${trackPath}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="4.5" stroke-linecap="round"/>
    <path d="${valPath}" fill="none" stroke="${arcColor}" stroke-width="4.5" stroke-linecap="round" opacity="${isLocked?0.5:1}" style="${glow}"/>
    ${isLocked ? '' : `<circle cx="${tipx}" cy="${tipy}" r="3" fill="${color}" style="filter:drop-shadow(0 0 4px ${color});"/>`}
    <circle cx="${cx}" cy="${cy+1.5}" r="${rCap}" fill="rgba(0,0,0,0.5)"/>
    <circle cx="${cx}" cy="${cy}" r="${rCap}" fill="${capFill}" stroke="rgba(0,0,0,0.65)" stroke-width="1"/>
    <circle cx="${cx}" cy="${cy-3}" r="${rCap-3}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
    <line x1="${nx1}" y1="${ny1}" x2="${nx2}" y2="${ny2}" stroke="${isLocked ? 'rgba(255,255,255,0.4)' : '#fff'}" stroke-width="2.5" stroke-linecap="round" opacity="${isLocked?0.6:0.95}"/>
  </svg>`;
}

/* Analog VU-style meter face with a rotating needle.
 * needleId: id stamped on the needle <g> (rotate it via setAttribute('transform', ...)).
 * restAngle: needle's idle angle — +52 for top-down meters (e.g. gain reduction,
 *            rests at right/0), -52 for bottom-up meters (e.g. output level,
 *            rests at left/silence). */
function buildVU(needleId, color, restAngle) {
  if (restAngle === undefined) restAngle = 52;
  const cx = 60, cy = 72, r = 50, rin = 43, span = 52, N = 7;
  let ticks = '';
  for (let i = 0; i < N; i++) {
    const a = (-span + (i / (N - 1)) * 2 * span) * Math.PI / 180;
    const x1 = cx + rin * Math.sin(a), y1 = cy - rin * Math.cos(a);
    const x2 = cx + r   * Math.sin(a), y2 = cy - r   * Math.cos(a);
    const major = (i === 0 || i === N - 1);
    ticks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="rgba(255,255,255,${major?0.42:0.16})" stroke-width="${major?1.6:1}"/>`;
  }
  const ex = cx + r * Math.sin(-span*Math.PI/180), ey = cy - r * Math.cos(-span*Math.PI/180);
  const sx = cx + r * Math.sin( span*Math.PI/180), sy = cy - r * Math.cos( span*Math.PI/180);
  return `<svg class="vu-svg" viewBox="0 0 120 84" xmlns="http://www.w3.org/2000/svg">
    <path d="M ${ex.toFixed(1)} ${ey.toFixed(1)} A ${r} ${r} 0 0 1 ${sx.toFixed(1)} ${sy.toFixed(1)}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
    ${ticks}
    <g id="${needleId}" transform="rotate(${restAngle} ${cx} ${cy})">
      <line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - r + 7}" stroke="${color}" stroke-width="2.2" stroke-linecap="round" style="filter:drop-shadow(0 0 3px ${color});"/>
    </g>
    <circle cx="${cx}" cy="${cy}" r="4.5" fill="#15171b" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
  </svg>`;
}
