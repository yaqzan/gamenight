"""GameNight — board game tier list app + research pipeline.

Static SPA with no input surface. Data: data/games.json (gitignored, your
shelf) is the single source of truth for every UI fact; examples/games.json is
the example shelf a fresh clone runs on until `python -m gamenight init`.
"""

from pathlib import Path

__version__ = "1.0.0"

ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = ROOT / "data" / "games.json"
SEED_FILE = ROOT / "examples" / "games.json"
FRONTEND_DIR = ROOT / "frontend"
DIST_DIR = FRONTEND_DIR / "dist"
RESEARCH_DIR = ROOT / ".research"
