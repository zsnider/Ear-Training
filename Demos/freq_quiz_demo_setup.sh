#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  SonicSandbox Freq Quiz Demo — one-time setup
#  Run once before your first recording:  bash freq_quiz_demo_setup.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="$SCRIPT_DIR/.venv"

echo ""
echo "═══════════════════════════════════════════════"
echo "  Freq Quiz Demo — Setup"
echo "═══════════════════════════════════════════════"
echo ""

# 1. Create a virtual environment inside Demos/.venv
echo "▸ Creating virtual environment..."
python3 -m venv "$VENV_DIR"

# 2. Install Playwright into the venv
echo "▸ Installing playwright..."
"$VENV_DIR/bin/pip" install playwright --quiet

# 3. Install Chromium browser binary
echo "▸ Installing Chromium browser..."
"$VENV_DIR/bin/playwright" install chromium

# 4. Create output directory
mkdir -p "$SCRIPT_DIR/recordings"

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✓ Setup complete!"
echo ""
echo "  To record a demo:"
echo "    Demos/.venv/bin/python Demos/freq_quiz_demo.py"
echo ""
echo "  To record a specific number of rounds:"
echo "    Demos/.venv/bin/python Demos/freq_quiz_demo.py 20"
echo ""
echo "  Videos are saved to:  Demos/recordings/"
echo "═══════════════════════════════════════════════"
echo ""
