# Rating rubric — how a game earns its tiers

App answers one question: "given who is at the table tonight, what should we play?" Every
rating serves that.

## Core rule: relative to THIS shelf

pc tiers are not abstract quality scores. "S at 3p" = among the best this collection offers at
exactly 3 players; "C at 2p" = works, but the shelf has clearly better 2p nights. Calibrate
against `data/games.json`: find the most similar games and slot against them. A brilliant game
can land B in a crowded bracket; a modest one can hold S in a thin one.

## What to research (weight order)

1. **BGG**: weight rating + community player-count poll (Best/Recommended/Not Recommended per
   count) — strongest per-count signal available.
2. **r/boardgames + BGG forums**: "how does X play at N" experience threads.
3. **Reviewer consensus**: Shut Up & Sit Down, Dice Tower, Meeple Mountain, Space-Biff, etc.

Can't confidently identify the game (ambiguous name, editions play differently)? Stop and say
so — an honest error beats a fabricated rating.

## Fields (exact vocab + limits: `gamenight/schema.py`)

- **pc** — only counts the game actually supports, each rated per the core rule. Wide party
  ranges may sample counts (2, 4, 6, 8...) the way Wavelength does.
- **learn** — teach time for a table of NEW players: S instant, A ~10 min, B ~30 min, C needs an
  experienced table, D heavy rulebook, F very heavy. Rate the box the shelf owns, not the
  stripped base game.
- **learnExp** — only when expansions/advanced modes meaningfully raise the teach.
- **vibes** — 1-4 from the fixed vocabulary. Never invent a vibe.
- **sweet** — honest best count(s): "2p", "3-4p", "6-10p", "Any count".
- **note** — 1-3 punchy, opinionated sentences (≤340 chars); name count-dependent caveats. Match
  the voice of existing notes — read a few first.
