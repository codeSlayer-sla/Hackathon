#!/usr/bin/env python3
"""Cross-platform test runner for the Enterprise AI Mesh monorepo.

Runs every module's own test suite in its own process/cwd, so each module
keeps using its normal tooling (pytest for the Python services, vitest for
the frontend) instead of a shared custom harness.

Usage:
    python scripts/run_tests.py                    # run every module
    python scripts/run_tests.py --modules rag       # just one
    python scripts/run_tests.py --modules rag peer  # a subset
    python scripts/run_tests.py --list              # show module names

One-time setup per Python module (repeat per venv you test with):
    pip install -e shared/py -r services/<module>/requirements.txt -r requirements-test.txt
Frontend:
    cd services/frontend && npm install
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# shutil.which resolves to npm.cmd on Windows -- passing that path directly
# avoids relying on shell=True (and its argument-quoting quirks) entirely.
NPM = shutil.which("npm") or "npm"

MODULES: dict[str, dict] = {
    "shared": {"cmd": [sys.executable, "-m", "pytest", "shared/py/tests"], "cwd": ROOT},
    "rag": {"cmd": [sys.executable, "-m", "pytest", "tests"], "cwd": ROOT / "services" / "rag"},
    "router": {"cmd": [sys.executable, "-m", "pytest", "tests"], "cwd": ROOT / "services" / "router"},
    "peer": {"cmd": [sys.executable, "-m", "pytest", "tests"], "cwd": ROOT / "services" / "peer"},
    "installed-base": {
        "cmd": [sys.executable, "-m", "pytest", "tests"],
        "cwd": ROOT / "services" / "installed-base",
    },
    "frontend": {"cmd": [NPM, "test"], "cwd": ROOT / "services" / "frontend"},
    "technician-app": {"cmd": [NPM, "test"], "cwd": ROOT / "apps" / "technician-app"},
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--modules",
        "-m",
        nargs="+",
        choices=sorted(MODULES),
        help="Which module(s) to test. Default: all of them.",
    )
    parser.add_argument("--list", action="store_true", help="List available module names and exit.")
    args = parser.parse_args()

    if args.list:
        for name in MODULES:
            print(name)
        return 0

    selected = args.modules or list(MODULES)

    failures: list[str] = []
    for name in selected:
        spec = MODULES[name]
        print(f"\n=== {name} ===")
        result = subprocess.run(spec["cmd"], cwd=spec["cwd"])
        if result.returncode != 0:
            failures.append(name)

    print("\n" + "=" * 50)
    if failures:
        print(f"FAILED: {', '.join(failures)}")
        return 1

    print(f"All good: {', '.join(selected)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
