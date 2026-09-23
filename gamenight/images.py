"""BGG image lookup + backfill for data/games.json.

`image` holds BoardGameGeek's own CDN URL (the source of truth, portable,
no hosting burden). `imageLocal` is an OPTIONAL gitignored local cache under
frontend/public/images/ - downloaded bytes of the same picture, served
straight off disk (Vite copies public/ into dist/ on build, server.py already
serves dist/ as-is - no server changes needed). It exists purely so the site
doesn't depend on BGG's CDN staying reachable/hotlink-friendly; it is never
committed and a missing file just falls back to the `image` URL client-side.
Dry-run by default; --apply backs up games.json first (same convention as
research.py). Existing `image` values are left alone unless --force.
"""

import os
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

from . import DATA_FILE, FRONTEND_DIR
from .data import backup, load_games, save_games

IMAGES_DIR = FRONTEND_DIR / "public" / "images"
BGG_SEARCH = "https://boardgamegeek.com/xmlapi2/search"
BGG_THING = "https://boardgamegeek.com/xmlapi2/thing"
USER_AGENT = "gamenight-tierlist/1.0 (+https://github.com/yaqzan/gamenight)"
POLITE_DELAY = 1.2  # seconds between BGG requests
VALID_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}

# BGG's XML API now requires a registered "application" + Bearer token
# (register at https://boardgamegeek.com/applications - non-commercial is
# free but approval can take up to ~a week). Set BGG_API_TOKEN once you have
# one; this module refuses to run without it rather than fail per-request.
TOKEN_ENV_VAR = "BGG_API_TOKEN"


def _fetch(url, params, retries=3):
    token = os.environ.get(TOKEN_ENV_VAR)
    if not token:
        raise RuntimeError(
            f"{TOKEN_ENV_VAR} is not set - BGG's XML API requires a registered application token now "
            "(register at https://boardgamegeek.com/applications, non-commercial license, then "
            f"set {TOKEN_ENV_VAR} to a token from the app's Tokens page)"
        )
    full = f"{url}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(full, headers={"User-Agent": USER_AGENT, "Authorization": f"Bearer {token}"})
    last_err = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                return resp.read()
        except Exception as e:
            last_err = e
            time.sleep(2 * (attempt + 1))
    raise last_err


def find_bgg_id(name):
    """Search BGG for `name`; return (id, matched_name) or (None, None)."""
    body = _fetch(BGG_SEARCH, {"query": name, "type": "boardgame"})
    root = ET.fromstring(body)
    items = root.findall("item")
    if not items:
        return None, None
    target = name.strip().casefold()
    exact = [it for it in items if (it.find("name").get("value") or "").strip().casefold() == target]
    pick = exact[0] if exact else items[0]
    matched = pick.find("name").get("value")
    return pick.get("id"), matched


def fetch_image_url(bgg_id):
    body = _fetch(BGG_THING, {"id": bgg_id})
    root = ET.fromstring(body)
    item = root.find("item")
    if item is None:
        return None
    img = item.find("image")
    return img.text.strip() if img is not None and img.text else None


def lookup_image(name):
    """Best-effort: game name -> (image_url, matched_bgg_name), (None, None) on miss."""
    bgg_id, matched = find_bgg_id(name)
    if not bgg_id:
        return None, None
    return fetch_image_url(bgg_id), matched


def slugify(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:60] or "game"


def download_local(url, slug):
    """Download `url` (a BGG image URL, no auth needed - it's a plain CDN asset)
    to frontend/public/images/<slug><ext>. Returns the `imageLocal` value
    ("images/<slug><ext>") or None on failure."""
    ext = Path(urllib.parse.urlparse(url).path).suffix.lower()
    if ext not in VALID_EXTS:
        ext = ".jpg"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()
    except Exception:
        return None
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    (IMAGES_DIR / f"{slug}{ext}").write_bytes(data)
    return f"images/{slug}{ext}"


def backfill(apply=False, force=False, only=None, local=True):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    games = load_games()
    targets = games if not only else [g for g in games if g["name"] in only]
    if only:
        missing = set(only) - {g["name"] for g in targets}
        if missing:
            raise SystemExit(f"not on the shelf: {sorted(missing)}")
    pending = [g for g in targets if force or not g.get("image")]

    if pending and not os.environ.get(TOKEN_ENV_VAR):
        raise SystemExit(
            f"{TOKEN_ENV_VAR} is not set - BGG's XML API requires a registered application token now.\n"
            "Register (free, non-commercial) at https://boardgamegeek.com/applications, "
            f"then set {TOKEN_ENV_VAR} to a token from the app's Tokens page and re-run.\n"
            "(All requested games already have an `image` URL, so a plain `--only ... ` run without new "
            "lookups - e.g. just downloading local copies - does not need this.)"
        )

    print(f"{len(pending)} / {len(games)} games need a BGG image lookup")

    url_results = {}
    misses = []
    for i, g in enumerate(pending, 1):
        print(f"[{i}/{len(pending)}] {g['name']} ...", end=" ", flush=True)
        try:
            url, matched = lookup_image(g["name"])
        except Exception as e:
            print(f"ERROR: {e}")
            misses.append(g["name"])
            time.sleep(POLITE_DELAY)
            continue
        if not url:
            print("no BGG match")
            misses.append(g["name"])
            time.sleep(POLITE_DELAY)
            continue
        note = "" if matched.casefold() == g["name"].casefold() else f" (matched BGG entry: {matched!r})"
        print(f"found{note}")
        url_results[g["name"]] = url
        time.sleep(POLITE_DELAY)

    print()
    print(f"resolved {len(url_results)} / {len(pending)}")
    if misses:
        print(f"misses ({len(misses)}): {misses}")

    # Local-copy pass: any target that now has (or already had) an `image` URL
    # but no `imageLocal` (or --force). Plain HTTP GET of the image asset -
    # no BGG API token involved, so this runs even if the lookup pass above
    # was skipped entirely (e.g. every game already had its URL).
    local_results = {}
    if local:
        by_name_current = {g["name"]: g for g in targets}
        need_local = []
        for g in targets:
            url = url_results.get(g["name"]) or g.get("image")
            if url and (force or not g.get("imageLocal")):
                need_local.append((g["name"], url))
        print(f"{len(need_local)} / {len(targets)} games need a local image download")
        for i, (name, url) in enumerate(need_local, 1):
            print(f"[{i}/{len(need_local)}] {name} (local) ...", end=" ", flush=True)
            path = download_local(url, slugify(name))
            if path:
                print("ok")
                local_results[name] = path
            else:
                print("download failed")

    if not apply:
        print()
        print("dry run - nothing written. Re-run with --apply to write these into games.json.")
        return

    if not url_results and not local_results:
        print("nothing to write")
        return

    backup()
    games = load_games()  # re-read in case games.json changed since the lookup pass
    by_name = {g["name"]: g for g in games}
    written = 0
    for name, url in url_results.items():
        if name in by_name:
            by_name[name]["image"] = url
            written += 1
    for name, path in local_results.items():
        if name in by_name:
            by_name[name]["imageLocal"] = path
    save_games(games)
    print(f"wrote {written} image URLs + {len(local_results)} local copies into {DATA_FILE}")
