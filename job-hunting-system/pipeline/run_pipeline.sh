#!/usr/bin/env bash
# run_pipeline.sh — Run SEARCH → SCORE → STORE pipeline
set -euo pipefail

VENV_PYTHON="/home/mfrl/.hermes/hermes-agent/venv/bin/python3"
PIPELINE_DIR="/home/mfrl/job-hunting/job-hunting-system/pipeline"
LATEST_LISTINGS=$(ls -t /home/mfrl/job-hunting/job-hunting-system/agents/scout/outputs/listings_*.json 2>/dev/null | head -1)

echo "============================================"
echo "  PIPELINE RUN: scout_search → matcher_score"
echo "============================================"

# 1) Scout: search
echo ""
echo "--- SEARCH ---"
$VENV_PYTHON "$PIPELINE_DIR/scout_search.py" 2>&1

# Get the latest listings file
LATEST_LISTINGS=$(ls -t /home/mfrl/job-hunting/job-hunting-system/agents/scout/outputs/listings_*.json 2>/dev/null | head -1)
echo ""
echo "Scored against: $LATEST_LISTINGS"

# 2) Matcher: score + store
echo ""
echo "--- SCORE + STORE ---"
$VENV_PYTHON "$PIPELINE_DIR/matcher_score.py" "$LATEST_LISTINGS" --mode first_cut --threshold 50 2>&1

echo ""
echo "--- JOB STORE SUMMARY ---"
$VENV_PYTHON "$PIPELINE_DIR/job_store.py" stats 2>&1