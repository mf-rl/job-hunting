#!/usr/bin/env python3
"""One-shot: print the raw LLM output for a tiny JSON prompt to diagnose parsing failures."""
import subprocess, os, sys
from pathlib import Path

HERMES_HOME = Path(os.environ.get("HERMES_HOME") or "/home/mfrl/.hermes")
VENV_PYTHON = HERMES_HOME / "hermes-agent" / "venv" / "bin" / "python3"

prompt = 'Return ONLY a JSON object, no other text: {"name": "test", "items": [1, 2, 3]}'
r = subprocess.run(
    [str(VENV_PYTHON), "-m", "hermes_cli.main", "chat", "-p", "cv-adapter", "-q", prompt, "-Q"],
    capture_output=True, text=True, timeout=60,
    env={**os.environ, "HERMES_HOME": str(HERMES_HOME)},
)
print("--- STDOUT ---")
print(repr(r.stdout))
print("--- STDERR ---")
print(repr(r.stderr[:200]))
