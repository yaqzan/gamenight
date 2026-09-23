"""Load/save/back up the shelf file.

`data/games.json` is YOUR shelf and is gitignored. A fresh clone has only the
example shelf in `examples/games.json`: reads fall back to it so `serve`,
`validate` and the frontend build work straight away, but every write needs a
real `data/games.json` (`python -m gamenight init` copies the example in).
"""

import json
import shutil
from datetime import datetime

from . import DATA_FILE, RESEARCH_DIR, SEED_FILE

BACKUP_DIR = RESEARCH_DIR / "backups"


def data_source():
    """The file reads come from: your shelf if it exists, else the example."""
    return DATA_FILE if DATA_FILE.exists() else SEED_FILE


def load_games():
    return json.loads(data_source().read_text(encoding="utf-8"))


def require_own_data():
    if not DATA_FILE.exists():
        raise SystemExit(
            f"no {DATA_FILE} yet - run `python -m gamenight init` first "
            "(copies the example shelf; add --empty to start from nothing)"
        )


def save_games(games):
    require_own_data()
    text = json.dumps(games, indent=2, ensure_ascii=False)
    DATA_FILE.write_text(text + "\n", encoding="utf-8", newline="\n")


def backup():
    require_own_data()
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    dest = BACKUP_DIR / f"games-{stamp}.json"
    shutil.copy2(DATA_FILE, dest)
    print(f"backed up games.json -> {dest}")
    return dest


def init(empty=False):
    if DATA_FILE.exists():
        raise SystemExit(f"{DATA_FILE} already exists - leaving it alone")
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    if empty:
        DATA_FILE.write_text("[]\n", encoding="utf-8", newline="\n")
        print(f"created an empty shelf at {DATA_FILE}")
    else:
        shutil.copy2(SEED_FILE, DATA_FILE)
        print(f"copied the example shelf to {DATA_FILE} - edit it or `research` games into it")
