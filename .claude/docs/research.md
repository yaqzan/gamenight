# Adding a game to the collection

User asks to add/rate a game: do the research in-session. The script is the hands-off
alternative, not a prerequisite.

## Protocol

1. Read [rating-rubric.md](rating-rubric.md), `gamenight/schema.py` (vocab/limits), then
   `data/games.json`, the calibration baseline. (It's gitignored; a fresh clone reads
   `examples/games.json` until `python -m gamenight init`.)
2. Web-research per the rubric (BGG player-count poll first). Unsure which game/edition is meant:
   ask, don't guess.
3. Draft the entry. Show the user the entry + per-count reasoning (which shelf games it joins at
   each tier) before touching data.
4. Merge: copy games.json to `.research/backups/games-<yyyymmdd_hhmmss>.json` first. Insert
   alphabetically (casefold), keep 2-space indent + trailing newline. **Never replace an existing
   entry without the user's explicit go-ahead.**
5. `py -3.11 -m gamenight validate`, then `cd frontend && npm run build` (live immediately).

## The script (same rubric, no interaction)

`py -3.11 -m gamenight research "Name" [--notes "..."] [--apply]` dispatches a Claude Code
subagent. Its prompt = the rubric + a live calibration digest + the machine's file-based dispatch
rules (no API key, ever). Code: `gamenight/research.py`.

- Dry-run by default: prints entry, rationale, sources, and the exact
  `--apply --from <result.json>` command to merge later without re-researching.
- `--force` replaces an existing entry. Also `--no-build`, `--timeout`, `--model`.

### BGG pass (`bggId`, `image`, `time`)

After the subagent returns the judgment fields (name/learn/pc/vibes/sweet/note), `research.run`
fills 3 optional fields itself from one BGG lookup, with no extra subagent turn: `bggId` (name
search), then `image` and `time` (keyed off that id). The in-session protocol does the same pass
in steps 3/4. **A field already on the entry (e.g. a hand-set `bggId`) is never overwritten.**

- BGG's XML API needs a registered app + Bearer token (anonymous = 401 as of 2026-08). Register a
  free non-commercial app at https://boardgamegeek.com/applications (approval up to ~1 week),
  then set `BGG_API_TOKEN`. Without it the BGG pass is skipped silently and the entry gets rubric
  fields only.
- The token is a Windows *User* env var, not in the repo or any file. Set once with
  `[System.Environment]::SetEnvironmentVariable('BGG_API_TOKEN', '<token>', 'User')`. A fresh
  PC/re-image needs this again (value: the BGG account's registered app, under "Tokens").

## BGG page link (`bggId`)

Numeric BoardGameGeek id, e.g. `"385761"` for Faraway. Cards link to
`https://boardgamegeek.com/boardgame/<bggId>` (click model: [design.md](design.md)). Name search
can hit the wrong edition for ambiguous titles (reissues, big-box bundles, same-name games). If
research already pinned an edition's id, set `bggId` on the entry before the BGG pass.

## Box art (`image`)

BGG-hosted URL from the `bggId`'s `<image>` field, hotlinked and never committed (we don't own the
art). Code: `gamenight/images.py`.

- `py -3.11 -m gamenight images [--only "Name" ...] [--force] [--no-local] [--apply]`: backfill
  existing entries missing `image`. Also caches a local copy to `frontend/public/images/`
  (`imageLocal`, gitignored) unless `--no-local`. Dry-run by default; `--apply` backs up first.

## Playtime (`time`)

`{"<count>": minutes}` for every supported count (same keys as `pc`). Powers the time column:
exact minutes for the selected count, else the min-max range. UI shows "—" when `time` is missing
(nothing on BGG: series entries, homebrew/reskinned party games).

**Not real per-count data** (BGG doesn't publish that). `gamenight/playtime.py` interpolates
linearly from `minplaytime` (lowest count) to `maxplaytime` (highest). Right for games that run
longer with more players, wrong for fixed-runtime games (timer/fixed-round). Spot-check outliers.

- `py -3.11 -m gamenight playtime [--only "Name" ...] [--force] [--apply]`: backfill existing
  entries missing `time`. Same dry-run/backup convention. Without `bggId` it falls back to a live
  name search; for ambiguous/obscure titles set `bggId` by hand first.
