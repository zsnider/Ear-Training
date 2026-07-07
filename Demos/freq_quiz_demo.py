#!/usr/bin/env python3
"""
SonicSandbox Freq Quiz Demo Automator
======================================
Opens a browser, plays the Freq Quiz game, A/Bs the signal, guesses correctly,
and records the session as a 9:16 video ready for social media.

Usage:
  python freq_quiz_demo.py          # ROUNDS rounds (see CONFIG below)
  python freq_quiz_demo.py 20       # override: 20 rounds

Requirements (run setup first):
  bash Demos/freq_quiz_demo_setup.sh
  Demos/.venv/bin/python Demos/freq_quiz_demo.py
"""

import asyncio
import random
import sys
import time
from pathlib import Path
from playwright.async_api import async_playwright

# ═══════════════════════════════════════════════════════════════════════════════
#  CONFIG — edit these before running
# ═══════════════════════════════════════════════════════════════════════════════

# How many rounds to play (0 = play forever until Ctrl-C)
ROUNDS = 12

# Game URL
GAME_URL = "https://sonicsandbox.app/freq-quiz/"

# ── Frequency bands ────────────────────────────────────────────────────────────
# All bands: [63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]
# 63 Hz is inaudible on phone speakers — disable it for phone-speaker demos
DISABLED_FREQS = [63]

# ── Difficulty ─────────────────────────────────────────────────────────────────
# 12 = Easy  |  9 = Med-Easy  |  6 = Medium  |  4 = Med-Hard  |  3 = Hard
GAIN_DB = 12

# ── Direction ─────────────────────────────────────────────────────────────────
# 'boost' | 'cut' | 'both'
DIRECTION = 'boost'

# ── Audio source ──────────────────────────────────────────────────────────────
# 'pink'    — pink noise
# 'oneShot' — built-in instrument samples
# 'loop'    — built-in music loops
# 'custom'  — your own folder of audio files (set MUSIC_FOLDER below)
SOURCE = 'loop'
MUSIC_FOLDER = None   # e.g. '/Users/zach/Music/demo-tracks'

# ── Bot behavior ───────────────────────────────────────────────────────────────
# Fraction answered correctly (1.0 = always right; 0.85 = realistic human)
ACCURACY = 1.0

# Seconds of initial listening before doing A/B
LISTEN_BEFORE_AB  = (1.5, 2.5)   # (min, max)

# A/B cycles per round (how many times to flip filtered ↔ dry before answering)
AB_CYCLES = 2

# Seconds to hold each side of the A/B toggle
AB_HOLD = (0.8, 1.4)

# Seconds to pause after A/B before clicking the answer
PAUSE_BEFORE_ANSWER = (0.4, 0.9)

# ── Output ─────────────────────────────────────────────────────────────────────
OUTPUT_DIR = Path(__file__).parent / "recordings"

# 9:16 portrait (TikTok / Reels / Shorts).  Change to 1080×1080 for square.
VIEWPORT_W = 430
VIEWPORT_H = 932

# CSS zoom applied after page load (0.0–1.0).
# The game is taller than the viewport at full size, so we scale it down.
# 0.82 fits the full device on a 430×932 canvas with nav/footer hidden.
# Increase toward 1.0 if content looks too small; decrease if it still clips.
CSS_ZOOM = 0.82

# ═══════════════════════════════════════════════════════════════════════════════

ALL_FREQS = [63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]


def rand(lo, hi):
    return random.uniform(lo, hi)


def choose_answer(target: int) -> int:
    """Return the frequency the bot will click."""
    if random.random() < ACCURACY:
        return target
    # Wrong: pick an adjacent band for a believable miss
    pool = [f for f in ALL_FREQS if f not in DISABLED_FREQS and f != target]
    if not pool:
        return target
    idx = ALL_FREQS.index(target)
    weights = [1.0 / (abs(ALL_FREQS.index(f) - idx) + 0.5) for f in pool]
    total = sum(weights)
    r = random.random() * total
    cumulative = 0.0
    for f, w in zip(pool, weights):
        cumulative += w
        if r <= cumulative:
            return f
    return pool[-1]


async def wait_for_round(page, timeout_s: float = 20.0) -> int:
    """Poll until the game has a live unanswered round. Returns targetFreq.

    NOTE: the game uses 'let' not 'var', so variables are NOT on window.
    We must use bare expressions (no function wrapper) so CDP evaluates them
    in the full script scope where let-bindings are visible.
    """
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        ra  = await page.evaluate("roundActive")
        ans = await page.evaluate("answered")
        tf  = await page.evaluate("targetFreq")
        if ra and not ans and tf:
            return int(tf)
        await asyncio.sleep(0.12)
    raise TimeoutError("Timed out waiting for a live round")


async def ab_toggle(page, cycles: int = AB_CYCLES):
    """Flip between filtered and dry signal `cycles` times."""
    for _ in range(cycles):
        await page.evaluate("setMonitor('dry')")      # function decl → on window, works fine
        await asyncio.sleep(rand(*AB_HOLD))
        await page.evaluate("setMonitor('filtered')")
        await asyncio.sleep(rand(*AB_HOLD))


async def style_for_recording(page):
    """Hide nav/footer/help and zoom the page to fit the recording viewport."""
    await page.add_style_tag(content=f"""
        /* Hide chrome that eats vertical space */
        nav.site-nav,
        footer,
        .help-toggle,
        .help-section   {{ display: none !important; }}

        /* Remove body breathing room so the game fills edge-to-edge */
        body            {{ margin: 0 !important; padding: 0 !important;
                          overflow: hidden !important; background: #0a0b0d; }}

        /* Scale everything down so the full device fits the viewport.
           CSS zoom is the cleanest approach — it scales layout AND paint. */
        html            {{ zoom: {CSS_ZOOM}; }}
    """)


async def configure_game(page):
    """Apply all CONFIG settings to the live page."""

    # Gain (select element)
    await page.select_option('#gainSelect', str(GAIN_DB))

    # Direction pills
    dir_ids = {'boost': 'dirBoost', 'cut': 'dirCut', 'both': 'dirBoth'}
    dir_id = dir_ids.get(DIRECTION, 'dirBoost')
    try:
        await page.click(f'#{dir_id}', timeout=2000)
    except Exception:
        await page.evaluate(f"direction = '{DIRECTION}'")

    # Disable specified frequency bands.
    # activeFreqs is a 'let' → not on window → must use bare expression, not () => wrapper.
    for freq in DISABLED_FREQS:
        await page.evaluate(f"activeFreqs.delete({freq})")
        await page.evaluate(
            f"const _b = document.getElementById('freq-{freq}');"
            f"if (_b) {{ _b.classList.add('freq-off'); _b.disabled = true; }}"
        )

    # Source
    if SOURCE == 'custom' and MUSIC_FOLDER:
        await load_custom_music(page)
    else:
        src_ids = {'pink': 'srcPink', 'oneShot': 'srcOneShot', 'loop': 'srcLoop'}
        src_id = src_ids.get(SOURCE, 'srcPink')
        try:
            await page.click(f'#{src_id}', timeout=2000)
        except Exception:
            await page.evaluate(f"setSource('{SOURCE}')")
        if SOURCE in ('loop', 'oneShot'):
            await asyncio.sleep(1.5)  # let manifest load

    print(f"  Config: gain=±{GAIN_DB}dB  direction={DIRECTION}  "
          f"source={SOURCE}  disabled={DISABLED_FREQS}")


async def load_custom_music(page):
    folder = Path(MUSIC_FOLDER)
    if not folder.is_dir():
        print(f"  [warn] MUSIC_FOLDER not found: {MUSIC_FOLDER} — using loops")
        await page.evaluate("setSource('loop')")
        return
    AUDIO_EXTS = {'.mp3', '.wav', '.ogg', '.aac', '.flac', '.m4a'}
    files = [str(p) for p in sorted(folder.iterdir()) if p.suffix.lower() in AUDIO_EXTS]
    if not files:
        print(f"  [warn] No audio files in {MUSIC_FOLDER} — using loops")
        await page.evaluate("setSource('loop')")
        return
    print(f"  Loading {len(files)} custom track(s)...")
    await page.locator('#folderInput').set_input_files(files)
    await page.evaluate(
        "setSource('custom');"
        "const p = document.getElementById('srcCustom');"
        "if (p) p.classList.add('active');"
    )
    try:
        await page.wait_for_function(
            "() => { const el = document.getElementById('uploadLabel'); "
            "return el && !el.textContent.includes('⧗'); }",
            timeout=30000
        )
    except Exception:
        pass
    print(f"  {len(files)} track(s) ready")


# ═══════════════════════════════════════════════════════════════════════════════

async def play_round(page, n: int):
    target = await wait_for_round(page)
    answer = choose_answer(target)

    # 1. Listen to filtered signal
    await asyncio.sleep(rand(*LISTEN_BEFORE_AB))

    # 2. A/B flip between filtered ↔ dry
    await ab_toggle(page)

    # 3. Brief pause, then answer
    await asyncio.sleep(rand(*PAUSE_BEFORE_ANSWER))

    correct = (answer == target)
    label = f"✓ {answer} Hz" if correct else f"✗ {answer} Hz (was {target} Hz)"
    print(f"  Round {n:>3}  target={target:>5} Hz  {label}")

    # Click the frequency button
    btn = page.locator(f'#freq-{answer}')
    try:
        await btn.click(timeout=3000)
    except Exception:
        await page.evaluate(f"submitAnswer({answer})")

    # Wait for auto-advance (correct=1.2s, wrong=2.0s, plus a small buffer)
    await asyncio.sleep(2.8 if correct else 3.5)


async def run(rounds: int):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    ts = int(time.time())

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=False,
            args=[
                '--autoplay-policy=no-user-gesture-required',
                f'--window-size={VIEWPORT_W},{VIEWPORT_H + 88}',
            ]
        )

        ctx = await browser.new_context(
            viewport={'width': VIEWPORT_W, 'height': VIEWPORT_H},
            record_video_dir=str(OUTPUT_DIR),
            record_video_size={'width': VIEWPORT_W, 'height': VIEWPORT_H},
        )

        page = await ctx.new_page()

        print(f"\n{'═'*55}")
        print(f"  Freq Quiz Demo Automator")
        print(f"  Rounds: {rounds or '∞'}   Output: {OUTPUT_DIR}")
        print(f"{'═'*55}\n")

        await page.goto(GAME_URL, wait_until='domcontentloaded')
        await asyncio.sleep(2.0)   # let all JS initialize

        await style_for_recording(page)
        await configure_game(page)
        await asyncio.sleep(0.5)

        # Click Play — unlocks Web Audio and starts round 1
        await page.click('#btnPlay')

        print("\n  Playing...\n")
        n = 0
        try:
            while True:
                n += 1
                await play_round(page, n)
                if rounds and n >= rounds:
                    break
        except KeyboardInterrupt:
            print("\n  Stopped.")
        except TimeoutError as e:
            print(f"\n  [timeout] {e}")

        print(f"\n  {n} round(s) done. Saving video...")
        await asyncio.sleep(1.0)
        await ctx.close()

        # Rename Playwright's UUID-named file to something readable
        videos = sorted(OUTPUT_DIR.glob("*.webm"), key=lambda p: p.stat().st_mtime)
        if videos:
            dest = OUTPUT_DIR / f"freq_quiz_{ts}.webm"
            videos[-1].rename(dest)
            print(f"  ✓ Saved: {dest}\n")
        else:
            print("  [warn] No video file found in recordings/\n")

        await browser.close()


if __name__ == '__main__':
    rounds_arg = int(sys.argv[1]) if len(sys.argv) > 1 else ROUNDS
    asyncio.run(run(rounds_arg))
