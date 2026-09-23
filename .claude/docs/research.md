# Adding a game to the collection

User asks to add/rate a game → do the research in-session. The script is the hands-off
alternative, not a prerequisite.

## Protocol

1. Read [rating-rubric.md](rating-rubric.md) + `gamenight/schema.py` (vocab/limits), then
   `data/games.json` — the shelf is the calibration baseline (gitignored; a fresh clone reads
   `examples/games.json` until `python -m gamenight init`).
2. Web-research per the rubric (BGG player-count poll first). Unsure which game/edition is
   meant → ask, don't guess.
3. Draft the entry; show the user the entry + per-count reasoning (which shelf games it joins
   at each tier) before touching data.
4. Merge: copy games.json to `.research/backups/games-<yyyymmdd_hhmmss>.json` first, insert
   alphabetically (casefold), keep 2-space indent + trailing newline. Never replace an existing
   entry without the user's explicit go-ahead.
5. `py -3.11 -m gamenight validate`, then `cd frontend && npm run build` (live immediately, no
   restart).

## The script (same rubric, zero interaction)

`py -3.11 -m gamenight research "Name" [--notes "..."] [--apply]` — dispatches a Claude Code
subagent whose prompt = the rubric + a live calibration digest + the machine's
file-based-dispatch rules (no API key, ever). Dry-run by default: prints entry, rationale,
sources, and the exact `--apply --from <result.json>` command to merge later without
re-researching. `--force` replaces an existing entry; `--no-build`/`--timeout`/`--model` as
expected. Flow: `gamenight/research.py`.

After the subagent returns its entry (name/learn/pc/vibes/sweet/note — rubric-driven, judgment
fields), `research.run` backs 3 more optional fields itself, deterministically, off a single BGG
lookup — no extra subagent turn, no web-search tokens: **`bggId`** (search BGG by name), then
**`image`** and **`time`** (both keyed off that id). In-session protocol does this same BGG pass
as part of step 3/4. Any of the three already present on the entry (e.g. a hand-set `bggId` for
an ambiguous title) is left alone, never overwritten.

- BGG's XML API requires a registered app + Bearer token (anonymous = flat 401 as of 2026-08).
  Register a free non-commercial app at https://boardgamegeek.com/applications (approval up to
  ~1 week), set `BGG_API_TOKEN` in the environment. Without it the BGG pass is skipped silently
  — entry still gets written with rubric fields only, no image/bggId/time.
- Token lives in a Windows *User* env var (not in repo/any file): set once via
  `[System.Environment]::SetEnvironmentVariable('BGG_API_TOKEN', '<token>', 'User')`.
  Machine-local — a fresh PC/re-image needs this re-run once (value from the BGG account's
  registered app, under "Tokens").

## BGG page link (`bggId` field)

Optional per-entry `bggId` — numeric BoardGameGeek id, e.g. `"385761"` for Faraway. Frontend
uses it to make card tiles clickable to `https://boardgamegeek.com/boardgame/<bggId>` (any
tap/click outside the description navigates there; description expands on tap only when
truncated). Name search can land on the wrong edition for ambiguous titles (reissues, big-box
bundles, same-name-different-game collisions) — if research already pinned a specific edition's
id, set `bggId` on the entry directly before the BGG pass so it's used as-is.

## Box art (`image` field)

Optional per-entry `image` — BGG-hosted URL, hotlinked (never downloaded/committed, avoids
redistributing box art we don't own). Backfilled from `bggId`'s `<image>` field. Implementation:
`gamenight/images.py`.

- `py -3.11 -m gamenight images [--only "Name" ...] [--force] [--apply]` — backfill pass for
  existing entries missing `image` (new entries get it from `research` already). Dry-run by
  default; `--apply` backs up first, same convention as `research`.

## Playtime (`time` field)

Optional per-entry `time` — `{"<count>": minutes}` for every count the game supports (same keys
as `pc`). Powers the list-view time column: exact minutes for selected count, or full min-max
range with no count selected. Backfilled from `bggId`'s `minplaytime`/`maxplaytime` via
`gamenight/playtime.py` — linear interpolation between those anchors across supported counts (low
count = minplaytime, high count = maxplaytime), **not** real per-count poll data (BGG doesn't
publish that). Holds up for games that genuinely take longer with more players; off for
fixed-runtime games (timer/fixed-round). Spot-check outliers. UI falls back to "—" for games with
no `time` (nothing findable on BGG — series entries, homebrew/reskinned party games).

- `py -3.11 -m gamenight playtime [--only "Name" ...] [--force] [--apply]` — backfill pass for
  existing entries missing `time` (new entries get it from `research` already). Same
  dry-run/backup convention. Falls back to a live BGG name search if `bggId` is missing — for
  ambiguous/obscure titles that miss, set `bggId` by hand first rather than relying on search.
