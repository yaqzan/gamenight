# GameNight

Read-only public tier list of the board game shelf: https://gamenight.yaqzan.dev.
`data/games.json` is the single source of truth — every UI fact renders from it.

**Public repo (github.com/yaqzan/gamenight), plug and play.** The owner's data is gitignored
local state: `data/games.json`, `ops/cloudflared-config.yml`, `frontend/.env.local`
(`VITE_SITE_URL`). With no `data/games.json`, reads and the frontend build fall back to
`examples/games.json`; writes refuse until `init`. Never commit those files or hardcode a
machine path, domain or personal value into tracked code. Pre-2026-09-23 history lives in the
private `yaqzan/gamenight-archive`.

**"Add \<game\> to the collection"** → `.claude/docs/research.md`: research it
in-session against the rubric. The `research` script is the hands-off alternative.

## Commands

- `py -3.11 -m gamenight serve` — prod server, port 5004 (frontend/dist + /api/health)
- `py -3.11 -m gamenight research "Name" [--apply]` — subagent research (also backs
  `bggId`/`image`/`time` off one BGG lookup), dry-run default
- `py -3.11 -m gamenight playtime [--apply] [--only "Name" ...]` — backfill `time` on
  EXISTING entries missing it (new entries get it from `research` already), dry-run default
- `py -3.11 -m gamenight validate` — schema-check games.json · `init [--empty]` — create it from the example
- `py -3.11 -m unittest` — tests (example shelf, data fallback, vocab mirror, health)
- `cd frontend && npm run build` — deploy (live instantly, no restart) · `npm run dev` · `npm run icons`
- `C:\Development\server.ps1 start|status|logs -Service gamenight` — app + tunnel

## Invariants

- Never overwrite an existing games.json entry without the user's explicit go-ahead;
  back up to `.research/backups/` before every merge. Human edits win.
- Vocabulary lives in `gamenight/schema.py` AND `frontend/src/constants.ts` — change together
  (a test enforces it).
- Box art (`image` field) needs a BGG API token in the `BGG_API_TOKEN` env var (Windows
  User-level, not in the repo) — see `.claude/docs/research.md` for where it comes from.
- UI: quality (per-count) colors and teach-time washes are SEPARATE visual languages — never
  render teach time as a letter/badge. Tokens per theme in `frontend/src/app.css`.

Docs: rating rubric → `.claude/docs/rating-rubric.md` · add-a-game protocol →
`.claude/docs/research.md` · hosting/tunnel/watchdog → `.claude/docs/ops.md` ·
design system (views/themes/badges/wash) → `.claude/docs/design.md` (canvas sources in `design/`) ·
kanban → vault `Engineering Wiki/Projects/GameNight/`.
