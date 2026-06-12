#!/usr/bin/env python3
"""
SonicSandbox EQ Match Demo Automator
=====================================
Automates the EQ Match game at sonicsandbox.app/eq-match/ for screen recording.

Simulates a skilled human player who:
  1. Starts a new round
  2. A/Bs between Target and My EQ several times
  3. Drags nodes to near-correct positions with smooth, human-like mouse movement
  4. Scores 85–95% each round
  5. Repeats indefinitely

Usage:
  python eq_match_demo.py              # 999 rounds (endless)
  python eq_match_demo.py 20           # 20 rounds
  python eq_match_demo.py 20 beginner  # 20 rounds, force Beginner tier

Requirements:
  pip install playwright
  playwright install chromium
"""

import asyncio
import math
import random
import sys

from playwright.async_api import async_playwright

# ── Coordinate math (mirrors JS in index.html) ─────────────────────────────────
LOG_MIN = math.log10(20)
LOG_MAX = math.log10(22000)

def freq_to_x(f: float, w: float) -> float:
    return ((math.log10(max(f, 20)) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * w

def gain_to_y(g: float, h: float) -> float:
    return h / 2 - (g / 18) * (h / 2 - 30)


# ── Scoring math (mirrors checkAnswer() in index.html) ────────────────────────
def compute_score(target_bands: list, user_bands: list) -> int:
    """Predict the score that checkAnswer() will give."""
    total = 0.0
    for tb, ub in zip(target_bands, user_bands):
        no_gain = tb["type"] in ("lowpass", "highpass", "notch")
        octave_dist = abs(math.log2(ub["frequency"] / tb["frequency"]))
        freq_score = max(0.0, 1 - octave_dist / 1.5)
        if no_gain:
            band_score = freq_score
        else:
            gain_diff = abs((tb.get("gain") or 0) - (ub.get("gain") or 0))
            gain_score = max(0.0, 1 - gain_diff / 8.0)
            band_score = 0.7 * freq_score + 0.3 * gain_score
        total += band_score
    return round((total / len(target_bands)) * 100)


# ── Near-correct guess generator ───────────────────────────────────────────────
def near_correct_band(tb: dict, target_score: float) -> tuple[float, float]:
    """
    Return (guess_freq, guess_gain) that will score approximately target_score
    against the given target band.

    target_score: 0.0–1.0  (e.g. 0.90 for 90%)
    """
    no_gain = tb["type"] in ("lowpass", "highpass", "notch")

    # Frequency error: freqScore = 1 - octaveDist/1.5 = target_score
    # → octaveDist = (1-target_score)*1.5
    # We spread actual error ±20 % around that value for variety
    octave_err = (1 - target_score) * 1.5 * random.uniform(0.7, 1.3)
    octave_err *= random.choice([-1, 1])
    guess_freq = tb["frequency"] * (2 ** octave_err)
    guess_freq = max(20, min(20000, guess_freq))

    if no_gain:
        guess_gain = 0.0
    else:
        # Gain error: gainScore = 1 - gainDiff/8 = target_score
        gain_err = (1 - target_score) * 8.0 * random.uniform(0.7, 1.3)
        gain_err *= random.choice([-1, 1])
        guess_gain = (tb.get("gain") or 0) + gain_err
        guess_gain = max(-18.0, min(18.0, guess_gain))

    return guess_freq, guess_gain


# ── Mouse helpers ──────────────────────────────────────────────────────────────
async def smooth_move(page, x1, y1, x2, y2, steps=40, duration_s=0.7):
    """Smoothstep-eased mouse move between two absolute page coordinates."""
    for i in range(1, steps + 1):
        t = i / steps
        ease = t * t * (3 - 2 * t)   # smoothstep
        # Add very tiny Perlin-ish jitter for organic feel
        jx = random.gauss(0, 0.4) if i < steps else 0
        jy = random.gauss(0, 0.4) if i < steps else 0
        await page.mouse.move(
            x1 + (x2 - x1) * ease + jx,
            y1 + (y2 - y1) * ease + jy,
        )
        await asyncio.sleep(duration_s / steps)


async def drag_node(page, rect, from_cx, from_cy, to_cx, to_cy,
                    steps=55, duration_s=1.4):
    """
    Drag a canvas node from canvas-local (from_cx, from_cy)
    to canvas-local (to_cx, to_cy).
    Adds a natural approach movement before pressing down.
    """
    abs_from_x = rect["x"] + from_cx
    abs_from_y = rect["y"] + from_cy
    abs_to_x   = rect["x"] + to_cx
    abs_to_y   = rect["y"] + to_cy

    # Approach from a slightly offset starting point
    approach_x = abs_from_x + random.uniform(-30, 30)
    approach_y = abs_from_y + random.uniform(-15, 15)
    cur_pos = await page.evaluate("() => ({ x: window.__mouseX || 0, y: window.__mouseY || 0 })")
    await smooth_move(page, approach_x, approach_y, abs_from_x, abs_from_y,
                      steps=20, duration_s=0.35)
    await asyncio.sleep(0.12)

    # Press and drag
    await page.mouse.down()
    await asyncio.sleep(0.08)
    await smooth_move(page, abs_from_x, abs_from_y, abs_to_x, abs_to_y,
                      steps=steps, duration_s=duration_s)
    await asyncio.sleep(0.08)
    await page.mouse.up()


async def hover_explore(page, rect, W, H, target_cx, target_cy, duration_s=2.2):
    """
    Float the mouse around the canvas as if thinking about the frequency,
    then converge toward (target_cx, target_cy) in canvas coordinates.
    Mouse is NOT pressed — pure hover / exploration.
    """
    cx, cy = rect["x"], rect["y"]

    # Random starting point on canvas
    sx = cx + random.uniform(W * 0.15, W * 0.85)
    sy = cy + H * 0.5 + random.uniform(-H * 0.15, H * 0.15)
    await page.mouse.move(sx, sy)
    await asyncio.sleep(0.1)

    # Two-stage drift: wander → converge
    mid_x = cx + (target_cx * 0.4 + W * 0.3 * random.uniform(-1, 1))
    mid_y = cy + target_cy * 0.5 + random.uniform(-20, 20)
    await smooth_move(page, sx, sy, mid_x, mid_y,
                      steps=35, duration_s=duration_s * 0.55)
    await asyncio.sleep(random.uniform(0.15, 0.4))

    # Optional small pause at midpoint (looks like recognition moment)
    end_x = cx + target_cx + random.uniform(-8, 8)
    end_y = cy + target_cy + random.uniform(-5, 5)
    await smooth_move(page, mid_x, mid_y, end_x, end_y,
                      steps=28, duration_s=duration_s * 0.45)


# ── Main automation loop ───────────────────────────────────────────────────────
async def run_demo(num_rounds: int = 999, target_url: str = "https://sonicsandbox.app/eq-match/"):
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=False,
            args=["--start-maximized", "--disable-infobars"],
        )
        context = await browser.new_context(no_viewport=True)
        page = await context.new_page()

        print(f"Opening {target_url} ...")
        await page.goto(target_url)
        await page.wait_for_load_state("domcontentloaded")
        await asyncio.sleep(3)

        # Dismiss any cookie banner (if present) by pressing Escape
        await page.keyboard.press("Escape")
        await asyncio.sleep(0.5)

        for round_num in range(1, num_rounds + 1):
            print(f"\n── Round {round_num} ─────────────────────────────")

            # ── Start new round ──────────────────────────────────────────────
            await page.click('button[onclick="newRound()"]')
            await asyncio.sleep(2.8)   # Audio needs a moment to initialise

            # Get canvas bounding rect
            rect = await page.evaluate("""() => {
                const r = document.getElementById("eqCanvas").getBoundingClientRect();
                return { x: r.x, y: r.y, width: r.width, height: r.height };
            }""")
            W, H = rect["width"], rect["height"]

            # ── A/B listening phase ──────────────────────────────────────────
            ab_cycles = random.randint(2, 3)
            for cycle in range(ab_cycles):
                # Target
                await page.click("#btnTarget")
                await asyncio.sleep(1.8 + random.uniform(0.0, 1.0))

                # My EQ
                await page.click("#btnMine")
                await asyncio.sleep(1.2 + random.uniform(0.0, 0.6))

            # ── Read game state ──────────────────────────────────────────────
            target_bands = await page.evaluate("targetBands")
            num_bands = len(target_bands)

            print(f"   Bands: {num_bands}  |  "
                  + "  ".join(f"B{i+1}: {b['frequency']:.0f}Hz "
                               f"{(b.get('gain') or 0):+.1f}dB [{b['type']}]"
                               for i, b in enumerate(target_bands)))

            starting_freqs = [1000.0, 400.0, 5000.0]

            # ── Drag each band to near-correct position ──────────────────────
            for i, tb in enumerate(target_bands):
                target_score = random.uniform(0.87, 0.95)
                guess_freq, guess_gain = near_correct_band(tb, target_score)

                # Predicted band score for this guess
                single_score = compute_score([tb], [{"frequency": guess_freq,
                                                      "gain": guess_gain,
                                                      "type": tb["type"]}])
                print(f"   Band {i+1}: targeting {guess_freq:.0f}Hz "
                      f"{guess_gain:+.1f}dB  (predicted {single_score}%)")

                # Read current user band position from JS state
                curr_bands = await page.evaluate("userBands")
                cur_freq = curr_bands[i]["frequency"] if i < len(curr_bands) else starting_freqs[i]
                cur_gain = (curr_bands[i].get("gain") or 0) if i < len(curr_bands) else 0.0

                from_cx = freq_to_x(cur_freq, W)
                from_cy = gain_to_y(cur_gain, H)
                to_cx   = freq_to_x(guess_freq, W)
                to_cy   = gain_to_y(guess_gain, H)

                # Hover/explore on canvas (looks like thinking)
                await hover_explore(page, rect, W, H, to_cx, to_cy,
                                    duration_s=1.6 + random.uniform(0, 0.8))
                await asyncio.sleep(random.uniform(0.2, 0.5))

                # Re-read band position before dragging (hover doesn't move bands)
                curr_bands = await page.evaluate("userBands")
                cur_freq = curr_bands[i]["frequency"] if i < len(curr_bands) else starting_freqs[i]
                cur_gain = (curr_bands[i].get("gain") or 0) if i < len(curr_bands) else 0.0
                from_cx = freq_to_x(cur_freq, W)
                from_cy = gain_to_y(cur_gain, H)

                # Drag the node
                await drag_node(page, rect, from_cx, from_cy, to_cx, to_cy,
                                steps=55, duration_s=1.3 + random.uniform(0.0, 0.5))
                await asyncio.sleep(random.uniform(0.3, 0.7))

            # ── Optional final A/B compare after placing bands ───────────────
            if random.random() > 0.45:
                await page.click("#btnTarget")
                await asyncio.sleep(1.2 + random.uniform(0, 0.5))
                await page.click("#btnMine")
                await asyncio.sleep(0.9 + random.uniform(0, 0.3))

            # ── Short pause before checking (player looks at result) ─────────
            await asyncio.sleep(0.5 + random.uniform(0.0, 0.5))

            # ── Check Answer ─────────────────────────────────────────────────
            await page.click("#btnCheck")

            # Read actual score
            await asyncio.sleep(0.5)
            score_text = await page.inner_text("#resultBig")
            print(f"   ✓ Score: {score_text}/100")

            # Linger on result screen
            await asyncio.sleep(4.0 + random.uniform(0.0, 2.0))

        print(f"\nFinished {num_rounds} rounds.")
        await browser.close()


# ── Entry point ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    rounds = int(sys.argv[1]) if len(sys.argv) > 1 else 999
    asyncio.run(run_demo(num_rounds=rounds))
