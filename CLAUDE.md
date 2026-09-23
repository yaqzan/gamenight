# GameNight

Read-only public tier list of the board game shelf: https://gamenight.yaqzan.dev.
**`data/games.json` is the single source of truth.** Every UI fact renders from it.

Public repo (github.com/yaqzan/gamenight). The owner's data is gitignored local state:
`data/games.json`, `ops/cloudflared-config.yml`, `frontend/.env.local` (`VITE_SITE_URL`).

- No `data/games.json`: reads and the frontend build fall back to `examples/games.json`;
  writes refuse until `init`.
- Never commit those files or hardcode a machine path, domain or personal value in tracked code.
- Pre-2026-09-23 history: private `yaqzan/gamenight-archive`.

**"Add \<game\> to the collection"**: follow `.claude/docs/research.md` in-session. The
`research` script is the hands-off alternative.

## Commands

- `py -3.11 -m gamenight serve`: prod server, port 5004 (frontend/dist + /api/health)
- `py -3.11 -m gamenight research "Name" [--apply]`: subagent research, also fills
  `bggId`/`image`/`time` from one BGG lookup. Dry-run default.
- `py -3.11 -m gamenight images|playtime [--apply] [--only "Name" ...]`: backfill `image`/`time`
  on EXISTING entries. Dry-run default.
- `py -3.11 -m gamenight validate`: schema-check games.json. `init [--empty]`: create it from the example.
- `py -3.11 -m unittest`: tests (example shelf, data fallback, vocab mirror, health)
- `cd frontend && npm run build`: deploy (live instantly, no restart). Also `npm run dev`, `npm run icons`.
- `C:\Development\server.ps1 start|status|logs -Service gamenight`: app + tunnel

## Invariants

- Never overwrite an existing games.json entry without the user's explicit go-ahead. Back up to
  `.research/backups/` before every merge. Human edits win.
- Vocabulary lives in `gamenight/schema.py` AND `frontend/src/constants.ts`. Change both (a test
  enforces it).
- Box art needs `BGG_API_TOKEN` (Windows User env var, not in the repo). Source: `research.md`.
- UI: quality colors and teach-time washes are separate visual languages. Never render teach time
  as a letter/badge. Tokens per theme in `frontend/src/app.css`.

## Docs

Rating rubric: `.claude/docs/rating-rubric.md` · add-a-game: `.claude/docs/research.md` ·
hosting/tunnel/watchdog: `.claude/docs/ops.md` · design system: `.claude/docs/design.md`
(canvas sources in `design/`) · kanban: vault `Engineering Wiki/Projects/GameNight/`.
