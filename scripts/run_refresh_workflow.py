#!/usr/bin/env python3
"""Run the complete catalog refresh under one stable repository lock."""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path
from typing import Any, Callable

import refresh_incremental as refresh


PROJECT_DIR = Path(__file__).resolve().parent.parent
SCRIPT_DIR = Path(__file__).resolve().parent

DEFAULT_WORKFLOW_PATHS = {
    "catalog": refresh.DEFAULT_CATALOG,
    "coaching": refresh.DEFAULT_COACHING,
    "state": refresh.DEFAULT_STATE,
    "overrides": refresh.DEFAULT_OVERRIDES,
    "curation": refresh.DEFAULT_CURATION,
    "review_queue": refresh.DEFAULT_REVIEW_QUEUE,
    "transaction_journal": refresh.DEFAULT_TRANSACTION_JOURNAL,
    "lock_file": refresh.DEFAULT_REFRESH_LOCK,
    "report": refresh.DEFAULT_REPORT,
}


def validate_apply_paths(args: argparse.Namespace) -> None:
    """Keep the full apply workflow scoped to its canonical repository files.

    Alternate paths remain useful for fixtures and one-off incremental tests,
    but the post-refresh thumbnail and integrity commands intentionally operate
    on the repository catalog. Call refresh_incremental.py directly when an
    alternate apply target is required.
    """
    if not args.apply:
        return

    alternate = [
        f"--{attribute.replace('_', '-')}"
        for attribute, default_path in DEFAULT_WORKFLOW_PATHS.items()
        if Path(getattr(args, attribute)).resolve() != default_path.resolve()
    ]
    if alternate:
        joined = ", ".join(alternate)
        raise refresh.RefreshError(
            "The full refresh workflow --apply requires canonical repository "
            f"paths; alternate path option(s): {joined}. Use "
            "scripts/refresh_incremental.py directly for an alternate target."
        )


def run_workflow(
    args: argparse.Namespace,
    *,
    command_runner: Callable[..., Any] = subprocess.run,
) -> dict[str, Any]:
    """Hold the repo lock through catalog, thumbnail, and integrity mutation."""
    lock_path = getattr(args, "lock_file", refresh.DEFAULT_REFRESH_LOCK)
    with refresh.exclusive_refresh_lock(lock_path):
        report = refresh._run_refresh_locked(
            args, ownership_token=refresh._LOCKED_WORKFLOW_TOKEN
        )
        refresh.print_refresh_summary(report, apply=args.apply)

        if args.apply:
            print("\nSelf-hosting and validating thumbnails...")
            command_runner(
                ["node", str(SCRIPT_DIR / "ensure-thumbnails.mjs")],
                cwd=PROJECT_DIR,
                check=True,
            )

            print("\nChecking catalog integrity...")
            command_runner(
                [
                    "node",
                    str(SCRIPT_DIR / "check_catalog_integrity.mjs"),
                    "--latest-thumbnail-report",
                ],
                cwd=PROJECT_DIR,
                check=True,
            )

        return report


def main() -> int:
    args = refresh.build_parser().parse_args()
    try:
        validate_apply_paths(args)
        run_workflow(args)
    except refresh.RefreshError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    except subprocess.CalledProcessError as exc:
        print(
            f"ERROR: refresh validation command failed with status {exc.returncode}",
            file=sys.stderr,
        )
        return exc.returncode or 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
