"""Stdlib-only tests: `python -m unittest` from the repo root."""

import json
import re
import shutil
import tempfile
import threading
import unittest
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest import mock

import gamenight
from gamenight import data, schema, server

ROOT = Path(gamenight.__file__).resolve().parent.parent


class ExampleShelf(unittest.TestCase):
    def test_example_shelf_is_valid(self):
        games = json.loads(gamenight.SEED_FILE.read_text(encoding="utf-8"))
        self.assertTrue(games)
        self.assertEqual(schema.validate_games(games), [])

    def test_example_has_no_local_image_paths(self):
        # imageLocal points into a gitignored cache a fresh clone doesn't have.
        games = json.loads(gamenight.SEED_FILE.read_text(encoding="utf-8"))
        self.assertFalse([g["name"] for g in games if "imageLocal" in g])


class VocabularyMirror(unittest.TestCase):
    """schema.py and frontend/src/constants.ts must carry the same vocabulary."""

    def setUp(self):
        self.ts = (ROOT / "frontend" / "src" / "constants.ts").read_text(encoding="utf-8")

    def ts_list(self, name):
        body = re.search(rf"export const {name}\b[^=]*=\s*\[(.*?)\]", self.ts, re.S).group(1)
        return re.findall(r'"([^"]+)"', body)

    def test_tiers_match(self):
        self.assertEqual(self.ts_list("TIER_ORDER"), schema.TIER_ORDER)

    def test_vibes_match(self):
        self.assertEqual(self.ts_list("ALL_VIBES"), schema.VIBES)


class DataFile(unittest.TestCase):
    """data/games.json missing (fresh clone) vs present (after init)."""

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tmp)
        self.shelf = self.tmp / "data" / "games.json"
        for name, value in (("DATA_FILE", self.shelf), ("BACKUP_DIR", self.tmp / "backups")):
            patcher = mock.patch.object(data, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)

    def test_reads_fall_back_to_example(self):
        self.assertEqual(data.data_source(), gamenight.SEED_FILE)
        self.assertEqual(len(data.load_games()), len(json.loads(gamenight.SEED_FILE.read_text(encoding="utf-8"))))

    def test_writes_need_your_own_shelf(self):
        with self.assertRaises(SystemExit):
            data.save_games([])
        with self.assertRaises(SystemExit):
            data.backup()
        self.assertFalse(self.shelf.exists())

    def test_init_copies_example_then_refuses_to_overwrite(self):
        data.init()
        self.assertEqual(self.shelf.read_bytes(), gamenight.SEED_FILE.read_bytes())
        self.shelf.write_text("[]\n", encoding="utf-8")
        with self.assertRaises(SystemExit):
            data.init()
        self.assertEqual(self.shelf.read_text(encoding="utf-8"), "[]\n")

    def test_init_empty(self):
        data.init(empty=True)
        self.assertEqual(data.load_games(), [])

    def test_save_then_backup(self):
        data.init(empty=True)
        data.save_games([{"name": "x"}])
        dest = data.backup()
        self.assertEqual(json.loads(dest.read_text(encoding="utf-8")), [{"name": "x"}])


class Health(unittest.TestCase):
    def test_health_reports_game_count(self):
        dist = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, dist)
        (dist / "index.html").write_text("<!doctype html>", encoding="utf-8")
        with mock.patch.object(server, "DIST_DIR", dist):
            httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
            threading.Thread(target=httpd.serve_forever, daemon=True).start()
            self.addCleanup(httpd.server_close)
            self.addCleanup(httpd.shutdown)
            url = f"http://127.0.0.1:{httpd.server_address[1]}/api/health"
            body = json.loads(urllib.request.urlopen(url, timeout=5).read())
        self.assertTrue(body["ok"])
        self.assertEqual(body["games"], len(data.load_games()))


if __name__ == "__main__":
    unittest.main()
