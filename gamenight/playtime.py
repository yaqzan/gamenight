"""Per-player-count playtime backfill for data/games.json.

BGG's API only reports one min/max playtime for a game, not a breakdown by
player count. `time` fills that in with a linear interpolation between those
two anchors across the player counts the game actually supports (from `pc`):
the low end of a game's supported count gets minplaytime, the high end gets
maxplaytime, everything between is interpolated and rounded to the nearest 5
minutes. This is a heuristic, not a poll result — it holds for the common
case (more players -> more turns -> longer game) but will be off for games
that don't scale that way (fixed-length card games, timer-based games). Spot
check before trusting it for an outlier.

Same dry-run-by-default / backup-before-apply convention as images.py.
"""

import os
import sys
import time

from . import DATA_FILE
from . import schema
from .data import backup, load_games, save_games
from .images import BGG_THING, TOKEN_ENV_VAR, POLITE_DELAY, _fetch, find_bgg_id
import xml.etree.ElementTree as ET


def fetch_playtime(bgg_id):
    """Return (minplaytime, maxplaytime) ints, or (None, None) on miss/parse failure."""
    body = _fetch(BGG_THING, {"id": bgg_id})
    root = ET.fromstring(body)
    item = root.find("item")
    if item is None:
        return None, None
    mn = item.find("minplaytime")
    mx = item.find("maxplaytime")
    try:
        mn_val = int(mn.get("value")) if mn is not None else None
        mx_val = int(mx.get("value")) if mx is not None else None
    except (TypeError, ValueError):
        return None, None
    if not mn_val and not mx_val:
        return None, None
    mn_val = mn_val or mx_val
    mx_val = mx_val or mn_val
    if mn_val > mx_val:
        mn_val, mx_val = mx_val, mn_val
    return mn_val, mx_val


def interpolate(counts, min_time, max_time):
    """counts: sorted list of ints (player counts this game supports).
    Returns {str(count): minutes} spanning min_time at the lowest count to
    max_time at the highest, rounded to the nearest 5 minutes."""
    lo, hi = counts[0], counts[-1]
    out = {}
    for c in counts:
        if hi == lo:
            mins = max_time
        else:
            frac = (c - lo) / (hi - lo)
            mins = min_time + frac * (max_time - min_time)
        out[str(c)] = max(5, round(mins / 5) * 5)
    return out


def backfill(apply=False, force=False, only=None):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    if not os.environ.get(TOKEN_ENV_VAR):
        raise SystemExit(
            f"{TOKEN_ENV_VAR} is not set - see .claude/docs/research.md for where it comes from"
        )

    games = load_games()
    targets = games if not only else [g for g in games if g["name"] in only]
    if only:
        missing = set(only) - {g["name"] for g in targets}
        if missing:
            raise SystemExit(f"not on the shelf: {sorted(missing)}")
    pending = [g for g in targets if force or not g.get("time")]

    print(f"{len(pending)} / {len(games)} games need a playtime lookup")

    results = {}
    misses = []
    for i, g in enumerate(pending, 1):
        print(f"[{i}/{len(pending)}] {g['name']} ...", end=" ", flush=True)
        bgg_id = g.get("bggId")
        matched_note = ""
        try:
            if not bgg_id:
                bgg_id, matched = find_bgg_id(g["name"])
                if bgg_id:
                    matched_note = f" (searched -> BGG #{bgg_id})"
                time.sleep(POLITE_DELAY)
            if not bgg_id:
                print("no BGG id (search miss)")
                misses.append(g["name"])
                continue
            mn, mx = fetch_playtime(bgg_id)
        except Exception as e:
            print(f"ERROR: {e}")
            misses.append(g["name"])
            time.sleep(POLITE_DELAY)
            continue
        if mn is None:
            print("no playtime data on BGG")
            misses.append(g["name"])
            time.sleep(POLITE_DELAY)
            continue
        counts = sorted(int(c) for c in g["pc"])
        by_count = interpolate(counts, mn, mx)
        results[g["name"]] = by_count
        print(f"{mn}-{mx} min -> {by_count}{matched_note}")
        time.sleep(POLITE_DELAY)

    print()
    print(f"resolved {len(results)} / {len(pending)}")
    if misses:
        print(f"misses ({len(misses)}): {misses}")

    if not apply:
        print()
        print("dry run - nothing written. Re-run with --apply to write these into games.json.")
        return

    if not results:
        print("nothing to write")
        return

    backup()
    games = load_games()
    by_name = {g["name"]: g for g in games}
    written = 0
    for name, by_count in results.items():
        if name in by_name:
            by_name[name]["time"] = by_count
            written += 1
    probs = schema.validate_games(games)
    if probs:
        for p in probs:
            print(f"INVALID after write: {p}")
        raise SystemExit("resulting games.json failed validation - not saved")
    save_games(games)
    print(f"wrote playtime for {written} games into {DATA_FILE}")
