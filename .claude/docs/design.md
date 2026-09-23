# Design system (2026-08 redesign)

Canvas: https://claude.ai/code/artifact/acd3201d-4e4e-4428-a698-678509199bc9. Sources:
`design/*.dc.html` + `canvas.json`.

- `design/gamenight-compass-redesign.html` is generated and gitignored. Re-seed and republish to
  the same canvas URL; don't hand-edit.
- The canvas covers visual language and layout only. BGG links, box art, playtime and sort modes
  were built in the app later and aren't in the mockups.

## Two visual languages: never mix

- **Quality** (how well a game plays at a player count) is the only thing colored badges/letters
  mean. Red to green ramp, `--q-S`..`--q-F` per theme in `app.css`. Band headers use the
  filled-disc `QualityBadge`; per-count boxes/cells color their letter via `qualityColor`.
- **Difficulty/teach time** is a row/card backdrop wash only (`--wash-S`..`--wash-F`, green to
  red) via `teachWash`. No text label or letter for it in a row/card. `TIER_DESC` wording
  (`"instant"`, `"~10 min"`, ...) appears only in the teach-gate filter chips in `Filters.tsx`.
  Owner rejected a teach-time letter badge.

## Views and themes

- Header toggles: Card View/List View (`CardsIcon`/`ListIcon`), Light/Dark Mode
  (`SunIcon`/`MoonIcon`). All 4 combos are first-class. State: localStorage `gn-view`/`gn-theme`.
- **Default: cards + dark** (flipped from the canvas's light/list; don't revert without asking).
- Theme = `html[data-theme]`. Every color/font is an `app.css` token.
- Light = "paper": Libre Franklin + Courier Prime, cream + vermillion `#c33d22`.
- Dark = "scoreboard": Barlow Condensed + Barlow + JetBrains Mono, near-black + amber `#f59e0b`.

## Shelf structure

- Count selected: games band by `pc[count]` (`QUALITY_LABEL`: Great/Very good/Fine/Stretched/
  Rough/Avoid). No count: one "whole shelf" band.
- Sort: `sort-toggle` segmented control (Random/Rank/Complexity/A-Z) on the first band, backed by
  `SortMode` in `types.ts`. Two independent modes:
  - `sortMode` (localStorage `gn-sort`, default `random`): the unfiltered whole-shelf view.
  - `countSortMode` (session-only, default `"complexity"` = easiest teach first): order within
    each band once a count is picked, so the wash reads as a gradient down the band.
- "Random" = stable per-page-load shuffle (`randomWeights`, seeded once via `useMemo`, no
  re-shuffle on re-render). "Rank" = `rankScore`, mean tier-rank across supported counts (lower
  is better).
- Search overrides every other filter (`handleSearchChange` clears count/vibe/gate on type). On
  purpose: with 99 games, combining search with filters adds nothing.
- Dice roll with a count selected pulls only from S-tier at that count (`rollPool` in `App.tsx`).

## Box art, BGG links, playtime (`Game` fields added after the canvas)

`types.ts` and `schema.py` (`ALLOWED_KEYS`) carry 4 optional fields, filled from one BGG lookup
by `gamenight/research.py` (new entries) or `gamenight images`/`gamenight playtime` (existing
ones). Pipeline and `BGG_API_TOKEN`: [`research.md`](research.md).

- **`image`**: BGG-hosted URL, source of truth. **`imageLocal`**: optional gitignored cache under
  `frontend/public/images/`, preferred when present (`imageLocal || image` everywhere). On load
  error: `imageLocal`, then `image`, then hide (`handleArtError`).
- **`bggId`**: card tile links to the game's BGG page (desktop only). On mobile the tap opens the
  note, so a corner icon carries the link (`card-bgg-link` / `ExternalLinkIcon` in `GameCard.tsx`).
- **`time`**: per-count playtime in minutes via `playtimeText()` (exact minutes for the selected
  count, else the full range). Sits in the old "teach" column in list view and the image-overlay
  corner in card view. It's playtime, not teach difficulty; don't rename it back to "teach".

## Card vs. row click models: don't unify

- **List rows** (`GameRow.tsx`): one big `<button>`. Click anywhere toggles an App-controlled
  `expanded` note (lifted state).
- **Cards** (`GameCard.tsx`): not buttons, own `expanded` state. Clicking the body opens BGG (if
  `bggId` and viewport ≥720px). Clicking note text toggles expand, only when the note is truncated
  (`useLayoutEffect` compares `scrollHeight` to `clientHeight`).

## Standing items

- S badge color is Variant 1 (deepest ramp green). A breakout color (ink `#241d12`, teal
  `#0f6b74`, brass `#a67c00`, samples on the canvas) is a one-line `--q-S` change per theme in
  `app.css`, if the owner asks.
- `constants.ts` holds vocabulary (synced with `gamenight/schema.py`) and tier/sort/format helpers
  (`byTeachWeight`, `byName`, `byRank`/`rankScore`, `playtimeText`). Colors and washes live only
  in `app.css` tokens. Never hardcode a hex in a component.
