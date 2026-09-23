import argparse


def main():
    parser = argparse.ArgumentParser(
        prog="gamenight",
        description="Game Night Compass - tier list server + research pipeline",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_serve = sub.add_parser("serve", help="serve frontend/dist + /api/health (production)")
    p_serve.add_argument("--port", type=int, default=5004)

    p_res = sub.add_parser(
        "research",
        help="research a game via a Claude Code subagent and slot it into the tier list",
    )
    p_res.add_argument("name", help='game name, e.g. "Cascadia"')
    p_res.add_argument("--notes", default="", help="hints for the researcher (edition, expansions owned, ...)")
    p_res.add_argument("--apply", action="store_true", help="merge into games.json + rebuild (default: dry run)")
    p_res.add_argument("--force", action="store_true", help="allow replacing an existing entry")
    p_res.add_argument("--no-build", action="store_true", help="with --apply: skip the frontend rebuild")
    p_res.add_argument("--timeout", type=int, default=900, help="subagent timeout in seconds (default 900)")
    p_res.add_argument("--model", default=None, help="override the subagent model (default: CLI default)")
    p_res.add_argument(
        "--from",
        dest="from_result",
        default=None,
        metavar="RESULT_JSON",
        help="skip the subagent; validate/apply an existing result.json from a previous dry run",
    )

    p_init = sub.add_parser("init", help="create data/games.json from the example shelf")
    p_init.add_argument("--empty", action="store_true", help="start from an empty shelf instead")

    sub.add_parser("validate", help="validate data/games.json against the schema")

    p_img = sub.add_parser("images", help="backfill BGG image URLs into games.json")
    p_img.add_argument("--apply", action="store_true", help="write resolved URLs (default: dry run)")
    p_img.add_argument("--force", action="store_true", help="re-lookup games that already have an image")
    p_img.add_argument("--only", nargs="+", default=None, metavar="NAME", help="limit to these game names")
    p_img.add_argument(
        "--no-local",
        action="store_true",
        help="skip downloading local copies to frontend/public/images/ (URL-only)",
    )

    p_time = sub.add_parser("playtime", help="backfill per-player-count playtime into games.json (BGG-anchored)")
    p_time.add_argument("--apply", action="store_true", help="write resolved times (default: dry run)")
    p_time.add_argument("--force", action="store_true", help="re-lookup games that already have a time field")
    p_time.add_argument("--only", nargs="+", default=None, metavar="NAME", help="limit to these game names")

    args = parser.parse_args()

    if args.cmd == "serve":
        from .server import serve

        serve(port=args.port)
    elif args.cmd == "research":
        from .research import run

        run(
            args.name,
            notes=args.notes,
            apply=args.apply,
            force=args.force,
            no_build=args.no_build,
            timeout=args.timeout,
            model=args.model,
            from_result=args.from_result,
        )
    elif args.cmd == "init":
        from .data import init

        init(empty=args.empty)
    elif args.cmd == "validate":
        from .research import validate_cmd

        validate_cmd()
    elif args.cmd == "images":
        from .images import backfill

        backfill(apply=args.apply, force=args.force, only=args.only, local=not args.no_local)
    elif args.cmd == "playtime":
        from .playtime import backfill as playtime_backfill

        playtime_backfill(apply=args.apply, force=args.force, only=args.only)


if __name__ == "__main__":
    main()
