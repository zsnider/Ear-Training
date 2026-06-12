#!/bin/bash
# One-time setup for eq_match_demo.py
# Run this once before your first screen recording session.

echo "Installing Playwright Python package..."
pip3 install playwright

echo ""
echo "Installing Chromium browser..."
python3 -m playwright install chromium

echo ""
echo "✓ Setup complete."
echo ""
echo "To run the demo automator:"
echo "  python3 eq_match_demo.py           # runs forever (999 rounds)"
echo "  python3 eq_match_demo.py 30        # runs 30 rounds then stops"
echo ""
echo "Start your screen recording BEFORE running the script."
echo "Press Ctrl+C to stop at any time."
