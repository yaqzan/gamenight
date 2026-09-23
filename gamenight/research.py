"""Research a board game with a Claude Code subagent and slot it into the shelf.

How it works (no API key on this machine — this rides the Claude subscription):
  1. Build a prompt FILE under .research/<slug>-<stamp>/ containing the shared
     rating rubric (.claude/docs/rating-rubric.md — the same file interactive
     agents follow), the output schema, and a calibration digest generated from
     data/games.json (every existing game, per player count, per tier) so the
     subagent rates the new game RELATIVE to this shelf, not in the abstract.
  2. Dispatch `claude -p` pointed at that file (WebSearch/WebFetch/Read/Write
     allowed). The subagent researches BGG, r/boardgames, and reviewers, then
     writes result.json next to the prompt.
  3. Validate result.json against gamenight/schema.py, print the proposed
     entry and where it slots at each player count.
  4. Dry-run by default. --apply backs up games.json to .research/backups/,
     merges (alphabetical insert), and rebuilds the frontend so the live site
     picks it up. Existing entries are never overwritten without --force —
     human edits win.
"""

import difflib
import json
import os
import re
import shutil
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

from . import DATA_FILE, FRONTEND_DIR, RESEARCH_DIR
from . import schema
from .data import backup, data_source, load_games, require_own_data, save_games

RUBRIC_FILE = Path(__file__).resolve().parent.parent / ".claude" / "docs" / "rating-rubric.md"

# Notes whose voice the subagent should imitate (picked for range: euro, filler,
# party-adjacent). Kept as names so the text always comes from live data.
STYLE_EXAMPLES = ["Honey Buzz", "Love Letter", "Concordia"]


def slugify(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:60] or "game"


# ── prompt construction ──────────────────────────────────────────────────


def calibration_digest(games):
    counts = sorted({int(c) for g in games for c in g["pc"]})
    lines = []
    for c in counts:
        tier_lines = []
        for tier in schema.TIER_ORDER:
            names = [g["name"] for g in games if g["pc"].get(str(c)) == tier]
            if names:
                tier_lines.append(f"- {tier}: " + "; ".join(names))
        if tier_lines:
            lines.append(f"### At {c} players")
            lines.extend(tier_lines)
            lines.append("")
    lines.append("### Learnability calibration (existing games per learn tier)")
    for tier in schema.TIER_ORDER:
        names = [g["name"] for g in games if g["learn"] == tier]
        if names:
            lines.append(f"- {tier} ({schema.LEARN_DESC[tier]}): " + "; ".join(names))
    return "\n".join(lines)


def style_digest(games):
    by_name = {g["name"]: g for g in games}
    lines = []
    for name in STYLE_EXAMPLES:
        g = by_name.get(name)
        if g:
            lines.append(f'- "{g["note"]}"')
    return "\n".join(lines)


def build_prompt(game_name, notes, games, result_path):
    # The rubric is the SAME file interactive agents follow (.claude/docs/
    # rating-rubric.md) — one source of truth for how a game earns its tiers.
    rubric = RUBRIC_FILE.read_text(encoding="utf-8")
    return f"""# Research task: slot "{game_name}" into the Game Night Compass shelf

You are researching ONE board game for a private board-game-collection app.
Use web search and page fetches. Follow the rubric below exactly.

User hints for this game: {notes or "none"}

{rubric}

## Vibe vocabulary (authoritative copy for this task — pick 1-4, EXACTLY these strings)

{"; ".join(schema.VIBES)}

## Note style — match this voice (short, concrete, opinionated)

{style_digest(games)}

## Calibration digest — the current shelf (this is what "relative" means)

{calibration_digest(games)}

## Your output — exactly one file

Write EXACTLY this file (raw JSON, UTF-8, no markdown fences, no comments):

    {result_path}

with this shape:

    {{
      "entry": {{
        "name": "...",            // canonical retail name (respect the edition in the hints, if any)
        "learn": "S|A|B|C|D|F",
        "learnExp": "...",        // OPTIONAL: only if expansions/advanced modes change the teach
        "pc": {{"2": "S", "3": "A"}},  // player count -> tier; ONLY counts the game actually supports
        "vibes": ["...", "..."],  // 1-4 strings from the vocabulary above
        "sweet": "3-4p",          // e.g. "2p", "3-4p", "6-10p", "1p", "Any count"
        "note": "..."             // 1-3 punchy sentences, max 340 chars, mention count-dependent caveats
      }},
      "rationale": {{
        "per_count": {{"2": "one line: why this tier at this count", "3": "..."}},
        "learn": "one line on the teach weight",
        "sources": ["bgg page / thread / review you leaned on", "..."],
        "confidence": "high|medium|low"
      }}
    }}

If you cannot confidently identify the game (ambiguous name, several editions
with different player behaviour, or it does not seem to exist), write instead:

    {{"error": "why", "candidates": ["possible matches", "..."]}}

Do not create or edit any other file. Do not guess — an honest error beats a
fabricated rating.
"""


# ── dispatch ─────────────────────────────────────────────────────────────


def find_claude():
    for name in ("claude", "claude.exe", "claude.cmd"):
        path = shutil.which(name)
        if path:
            return path
    raise SystemExit("claude CLI not found on PATH - install Claude Code first")


def dispatch(workdir, prompt_path, timeout, model=None):
    claude = find_claude()
    cmd = [
        claude,
        "-p",
        f'Read the file "{prompt_path}" and follow its instructions exactly.',
        "--allowedTools",
        "Read,Write,WebSearch,WebFetch",
        "--permission-mode",
        "acceptEdits",
    ]
    if model:
        cmd += ["--model", model]
    print(f"dispatching claude subagent (timeout {timeout}s) - this does live web research, expect minutes")
    t0 = time.time()
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(workdir),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        raise SystemExit(f"subagent timed out after {timeout}s (try --timeout with a larger value)")
    (workdir / "agent-output.txt").write_text(
        (proc.stdout or "") + "\n--- stderr ---\n" + (proc.stderr or ""), encoding="utf-8"
    )
    print(f"subagent finished in {time.time() - t0:.0f}s (exit {proc.returncode})")
    if proc.returncode != 0:
        print(f"WARNING: non-zero exit; see {workdir / 'agent-output.txt'}")


# ── result handling ──────────────────────────────────────────────────────


def read_result(result_path):
    if not result_path.exists():
        raise SystemExit(f"no result at {result_path} - see agent-output.txt next to it")
    try:
        result = json.loads(result_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise SystemExit(f"result.json is not valid JSON ({e}) - see {result_path}")
    if "error" in result:
        print(f"subagent could not identify the game: {result['error']}")
        for cand in result.get("candidates", []):
            print(f"  candidate: {cand}")
        raise SystemExit(2)
    entry = result.get("entry")
    probs = schema.validate_entry(entry, "entry")
    if probs:
        for p in probs:
            print(f"INVALID: {p}")
        raise SystemExit(f"result failed validation - raw file: {result_path}")
    return entry, result.get("rationale") or {}


def show_slotting(entry, games):
    print()
    print("=" * 72)
    print(f"proposed entry: {entry['name']}")
    print("=" * 72)
    print(json.dumps(entry, indent=2, ensure_ascii=False))
    print()
    print("slotting per player count (relative to the current shelf):")
    for count in sorted(entry["pc"], key=int):
        tier = entry["pc"][count]
        peers = [g["name"] for g in games if g["pc"].get(count) == tier]
        sample = "; ".join(peers[:4]) + (" ..." if len(peers) > 4 else "")
        print(f"  {count}p: {tier}  (joins {len(peers)} games{': ' + sample if peers else ''})")


def show_rationale(rationale):
    if not rationale:
        return
    print()
    print("rationale:")
    for count, why in sorted((rationale.get("per_count") or {}).items(), key=lambda kv: int(kv[0])):
        print(f"  {count}p: {why}")
    if rationale.get("learn"):
        print(f"  learn: {rationale['learn']}")
    for src in rationale.get("sources", []):
        print(f"  source: {src}")
    if rationale.get("confidence"):
        print(f"  confidence: {rationale['confidence']}")


def merge(games, entry, force):
    existing = {g["name"].casefold(): i for i, g in enumerate(games)}
    key = entry["name"].casefold()
    if key in existing:
        if not force:
            raise SystemExit(
                f"{entry['name']!r} is already on the shelf - re-run with --force to replace it "
                "(human edits win by default)"
            )
        old = games[existing[key]]
        print()
        print("REPLACING existing entry; old version:")
        print(json.dumps(old, indent=2, ensure_ascii=False))
        games[existing[key]] = entry
        return games
    games.append(entry)
    games.sort(key=lambda g: g["name"].casefold())
    return games


def rebuild():
    npm = shutil.which("npm.cmd") or shutil.which("npm")
    if not npm:
        print("WARNING: npm not found - rebuild skipped; run `cd frontend && npm run build` manually")
        return
    print("rebuilding frontend ...")
    proc = subprocess.run([npm, "run", "build"], cwd=str(FRONTEND_DIR), capture_output=True, text=True)
    if proc.returncode != 0:
        print(proc.stdout[-2000:] if proc.stdout else "")
        print(proc.stderr[-2000:] if proc.stderr else "")
        raise SystemExit("frontend build FAILED - games.json was updated, dist was not")
    print("frontend rebuilt - live site now serves the new data")


# ── entry point ──────────────────────────────────────────────────────────


def run(name, notes="", apply=False, force=False, no_build=False, timeout=900, model=None, from_result=None):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    if apply:
        require_own_data()  # fail before a 15-minute subagent run, not after it
    games = load_games()
    probs = schema.validate_games(games)
    if probs:
        for p in probs:
            print(f"DATA PROBLEM: {p}")
        raise SystemExit("data/games.json is invalid - fix it before researching")

    close = difflib.get_close_matches(name, [g["name"] for g in games], n=3, cutoff=0.75)
    exact = any(g["name"].casefold() == name.casefold() for g in games)
    if exact and not force:
        raise SystemExit(f"{name!r} is already on the shelf - use --force to re-research and replace it")
    if close and not exact:
        print(f"note: similar existing entries: {close} (continuing - use --force if this should replace one)")

    if from_result:
        # Apply/inspect a result produced by an earlier dispatch (no new subagent).
        result_path = Path(from_result)
    else:
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        workdir = RESEARCH_DIR / f"{slugify(name)}-{stamp}"
        workdir.mkdir(parents=True, exist_ok=True)
        result_path = workdir / "result.json"
        prompt_path = workdir / "prompt.md"
        prompt_path.write_text(build_prompt(name, notes, games, result_path), encoding="utf-8")
        print(f"prompt written -> {prompt_path}")
        dispatch(workdir, prompt_path, timeout=timeout, model=model)

    entry, rationale = read_result(result_path)

    # One BGG lookup pass backs three optional fields: bggId, image, and time (playtime).
    # bggId is the anchor - image and time both key off it once found.
    need_id = "bggId" not in entry
    need_image = "image" not in entry
    need_time = "time" not in entry
    if (need_id or need_image or need_time) and os.environ.get("BGG_API_TOKEN"):
        from . import images as bgg_images
        from . import playtime as bgg_playtime

        bgg_id = entry.get("bggId")
        matched = None
        if need_id or need_image:
            try:
                found_id, matched = bgg_images.find_bgg_id(entry["name"])
            except Exception as e:
                found_id, matched = None, None
                print(f"note: BGG id lookup failed ({e}) - continuing without image/time")
            bgg_id = bgg_id or found_id
            if need_id and found_id:
                entry["bggId"] = found_id
                note = "" if matched.casefold() == entry["name"].casefold() else f" (matched BGG entry: {matched!r})"
                print(f"found BGG id {found_id}{note}")

        if need_image:
            if bgg_id:
                try:
                    url = bgg_images.fetch_image_url(bgg_id)
                except Exception as e:
                    url = None
                    print(f"note: BGG image lookup failed ({e}) - continuing without one")
                if url:
                    entry["image"] = url
                    print("found BGG image")
                    local_path = bgg_images.download_local(url, bgg_images.slugify(entry["name"]))
                    if local_path:
                        entry["imageLocal"] = local_path
                else:
                    print("note: no BGG image match - entry will have no image")
            else:
                print("note: no BGG id match - entry will have no image")

        if need_time:
            if bgg_id:
                try:
                    mn, mx = bgg_playtime.fetch_playtime(bgg_id)
                except Exception as e:
                    mn, mx = None, None
                    print(f"note: BGG playtime lookup failed ({e}) - continuing without one")
                if mn is not None:
                    counts = sorted(int(c) for c in entry["pc"])
                    entry["time"] = bgg_playtime.interpolate(counts, mn, mx)
                    print(f"found BGG playtime {mn}-{mx} min -> {entry['time']}")
                else:
                    print("note: no BGG playtime data - entry will have no time field")
            else:
                print("note: no BGG id match - entry will have no time field")

    show_slotting(entry, games)
    show_rationale(rationale)

    if not apply:
        print()
        print(f"dry run - nothing written. To merge this result (edit {result_path} first if needed):")
        print(f'  python -m gamenight research "{name}" --apply --from "{result_path}"')
        return

    backup()
    merged = merge(load_games(), entry, force=force)
    save_games(merged)
    print(f"merged into {DATA_FILE} ({len(merged)} games)")
    if no_build:
        print("skipped rebuild (--no-build) - run `cd frontend && npm run build` to go live")
    else:
        rebuild()


def validate_cmd():
    games = load_games()
    probs = schema.validate_games(games)
    if probs:
        for p in probs:
            print(f"INVALID: {p}")
        raise SystemExit(1)
    counts = sorted({int(c) for g in games for c in g["pc"]})
    print(f"OK: {data_source()}: {len(games)} games, player counts {counts[0]}-{counts[-1]}, all entries valid")
