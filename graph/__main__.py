"""python -m graph setup|seed|serve"""

from __future__ import annotations

import argparse
import sys


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="NEXUS-CRIME graph module")
    parser.add_argument("command", choices=["setup", "seed", "serve"])
    args = parser.parse_args(argv)

    if args.command == "setup":
        from graph.schema import apply_schema

        print(apply_schema())
        return 0
    if args.command == "seed":
        from graph.seed_graph import seed

        print(seed())
        return 0
    if args.command == "serve":
        import uvicorn

        uvicorn.run("graph.app:app", host="0.0.0.0", port=8000, reload=True)
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
