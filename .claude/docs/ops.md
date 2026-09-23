# Ops

Standard machine pattern (Curator/Spice/Scribe): one port, own tunnel, 5-min watchdog.
Registered in `C:\Development\server.ps1` as `gamenight-api` + `gamenight-tunnel` (alias
`gamenight` selects both). Global machine rules (127.0.0.1-only, tunnel DNS routing convention)
in `~/.claude/CLAUDE.md`.

- **Port**: 5004 (127.0.0.1 only; next free in the 500x sequence).
- **Server**: `py -3.11 -u -m gamenight serve` — stdlib ThreadingHTTPServer serving
  `frontend/dist` with `/api/health` (`{ok, games, version}`; games count doubles as a data
  sanity signal). Hashed `/assets/*` get immutable cache headers; everything else no-cache, so a
  rebuild is live instantly without restart.
- **Tunnel**: name `gamenight` (UUID in the gitignored config), config
  `ops/cloudflared-config.yml` (gitignored; the repo ships `cloudflared-config.example.yml`),
  hostname `gamenight.yaqzan.dev`. Created 2026-08-23. ~30s of edge
  502s after a connector restart is normal.
- **Watchdog**: task "GameNight Watchdog", every 5 min, runs `ops/windows/watchdog.ps1` via the
  bundled `ops/windows/hidden_run.vbs`. Probes health + tunnel process and acts only on what's
  down: with `-Controller <script>` it calls `<script> start -Service <piece>`; without one it
  starts `python -m gamenight serve` / `cloudflared tunnel run` itself (the public-repo default).
  This machine's task must pass `-Controller C:\Development\server.ps1`. Logs to
  `ops/windows/logs/` (watchdog.log rotated at 512 KB). Re-register from an ELEVATED shell with
  `ops/windows/install-tasks.ps1 -Controller C:\Development\server.ps1` (unelevated falls back to
  schtasks and loses the at-logon trigger; `Set-ScheduledTask` is Access-denied unelevated too).
- **Deploy a data/frontend change**: `cd frontend && npm run build`. Research pipeline's
  `--apply` does this automatically.
- Site is deliberately public and read-only: no auth, no spend, no input surface.
