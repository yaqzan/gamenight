# Ops

Standard machine pattern (Curator/Spice/Scribe): one port, own tunnel, 5-min watchdog.
Registered in `C:\Development\server.ps1` as `gamenight-api` + `gamenight-tunnel` (alias
`gamenight` selects both). Machine-wide rules (127.0.0.1 only, tunnel DNS routing) live in
`~/.claude/CLAUDE.md`.

- **Port**: 5004, 127.0.0.1 only.
- **Server**: `py -3.11 -u -m gamenight serve`. Stdlib ThreadingHTTPServer serving
  `frontend/dist` plus `/api/health` (`{ok, games, version}`; the games count doubles as a data
  sanity check). Hashed `/assets/*` get immutable cache headers, everything else no-cache, so a
  rebuild is live without a restart.
- **Tunnel**: `gamenight`, hostname `gamenight.yaqzan.dev`, created 2026-08-23. Config
  `ops/cloudflared-config.yml` is gitignored (holds the UUID); the repo ships
  `cloudflared-config.example.yml`.
- **Watchdog**: task "GameNight Watchdog", every 5 min, runs `ops/windows/watchdog.ps1` through
  `ops/windows/hidden_run.vbs`. Probes health + tunnel process and restarts only what's down:
  - With `-Controller <script>`: calls `<script> start -Service <piece>`.
  - Without: starts `python -m gamenight serve` / `cloudflared tunnel run` itself (public-repo
    default). The tunnel is watched only if a controller is set or the config exists.
  - **This machine's task must pass `-Controller C:\Development\server.ps1`.**
  - Logs: `ops/windows/logs/` (watchdog.log rotates at 512 KB).
  - Re-register from an ELEVATED shell:
    `ops/windows/install-tasks.ps1 -Controller C:\Development\server.ps1`. Unelevated falls back
    to schtasks and loses the at-logon trigger (`Set-ScheduledTask` is also Access-denied).
- **Deploy a data/frontend change**: `cd frontend && npm run build`. `research --apply` runs it
  for you.
- Public and read-only on purpose: no auth, no spend, no input surface.
