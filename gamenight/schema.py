"""Shared vocabulary + validation for data/games.json.

Keep in sync with frontend/src/constants.ts (the UI's copy of the same
vocabulary). The research prompt injects the vibe vocabulary from THIS file, so
an edit here propagates to future research runs automatically; the prose rubric
both agents and the script follow is .claude/docs/rating-rubric.md.
"""

TIER_ORDER = ["S", "A", "B", "C", "D", "F"]

LEARN_DESC = {
    "S": "instant teach",
    "A": "~10 minute teach",
    "B": "~30 minute teach",
    "C": "needs an experienced table",
    "D": "heavy rulebook",
    "F": "very heavy",
}

VIBES = [
    "Strategy",
    "Duel",
    "Abstract",
    "Cooperative",
    "Solo",
    "Party",
    "Social Deduction",
    "Filler",
    "Worker Placement",
    "Deckbuilder",
    "Engine Builder",
    "Auction",
    "Racing",
    "Legacy",
    "Puzzle",
    "Chill",
]

MIN_COUNT, MAX_COUNT = 1, 20
NOTE_MAX = 400

REQUIRED_KEYS = {"name", "learn", "pc", "vibes", "sweet", "note"}
ALLOWED_KEYS = REQUIRED_KEYS | {"learnExp", "image", "imageLocal", "bggId", "time"}


def validate_entry(entry, label="entry"):
    """Return a list of problems (empty = valid)."""
    probs = []
    if not isinstance(entry, dict):
        return [f"{label}: not an object"]
    missing = REQUIRED_KEYS - set(entry)
    if missing:
        probs.append(f"{label}: missing keys {sorted(missing)}")
    extra = set(entry) - ALLOWED_KEYS
    if extra:
        probs.append(f"{label}: unknown keys {sorted(extra)}")
    name = entry.get("name")
    if not isinstance(name, str) or not name.strip():
        probs.append(f"{label}: name must be a non-empty string")
    for key in ("learn", "learnExp"):
        if key in entry and entry[key] not in TIER_ORDER:
            probs.append(f"{label}: {key} must be one of {TIER_ORDER}, got {entry[key]!r}")
    pc = entry.get("pc")
    if not isinstance(pc, dict) or not pc:
        probs.append(f"{label}: pc must be a non-empty object")
    else:
        for count, tier in pc.items():
            if not (isinstance(count, str) and count.isdigit() and MIN_COUNT <= int(count) <= MAX_COUNT):
                probs.append(f"{label}: pc key {count!r} must be a string integer {MIN_COUNT}-{MAX_COUNT}")
            if tier not in TIER_ORDER:
                probs.append(f"{label}: pc[{count!r}] must be one of {TIER_ORDER}, got {tier!r}")
    vibes = entry.get("vibes")
    if not isinstance(vibes, list) or not vibes:
        probs.append(f"{label}: vibes must be a non-empty list")
    else:
        bad = [v for v in vibes if v not in VIBES]
        if bad:
            probs.append(f"{label}: unknown vibes {bad} (vocabulary: {VIBES})")
        if len(vibes) > 5:
            probs.append(f"{label}: at most 5 vibes ({len(vibes)} given)")
    sweet = entry.get("sweet")
    if not isinstance(sweet, str) or not sweet.strip():
        probs.append(f"{label}: sweet must be a non-empty string")
    note = entry.get("note")
    if not isinstance(note, str) or not note.strip():
        probs.append(f"{label}: note must be a non-empty string")
    elif len(note) > NOTE_MAX:
        probs.append(f"{label}: note too long ({len(note)} > {NOTE_MAX} chars)")
    if "image" in entry:
        image = entry["image"]
        if not isinstance(image, str) or not image.strip():
            probs.append(f"{label}: image must be a non-empty string when present")
        elif not (image.startswith("https://") or image.startswith("http://")):
            probs.append(f"{label}: image must be an absolute URL, got {image!r}")
    if "imageLocal" in entry:
        local = entry["imageLocal"]
        if not isinstance(local, str) or not local.strip():
            probs.append(f"{label}: imageLocal must be a non-empty string when present")
        elif not local.startswith("images/"):
            probs.append(f"{label}: imageLocal must be a path under 'images/', got {local!r}")
        elif "image" not in entry:
            probs.append(f"{label}: imageLocal set without image (image is the source of truth)")
    if "bggId" in entry:
        bgg_id = entry["bggId"]
        if not (isinstance(bgg_id, str) and bgg_id.isdigit()):
            probs.append(f"{label}: bggId must be a string of digits, got {bgg_id!r}")
    if "time" in entry:
        time_field = entry["time"]
        if not isinstance(time_field, dict) or not time_field:
            probs.append(f"{label}: time must be a non-empty object when present")
        else:
            for count, mins in time_field.items():
                if not (isinstance(count, str) and count.isdigit() and MIN_COUNT <= int(count) <= MAX_COUNT):
                    probs.append(f"{label}: time key {count!r} must be a string integer {MIN_COUNT}-{MAX_COUNT}")
                if not (isinstance(mins, int) and not isinstance(mins, bool) and mins > 0):
                    probs.append(f"{label}: time[{count!r}] must be a positive integer (minutes), got {mins!r}")
    return probs


def validate_games(games):
    """Validate the whole list; returns a list of problems."""
    if not isinstance(games, list):
        return ["games.json: top level must be a list"]
    probs = []
    seen = {}
    for i, entry in enumerate(games):
        label = entry.get("name", f"#{i}") if isinstance(entry, dict) else f"#{i}"
        probs.extend(validate_entry(entry, label))
        if isinstance(entry, dict) and isinstance(entry.get("name"), str):
            key = entry["name"].casefold()
            if key in seen:
                probs.append(f"duplicate name: {entry['name']!r} (entries #{seen[key]} and #{i})")
            seen[key] = i
    return probs
