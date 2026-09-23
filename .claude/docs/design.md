# Design system (2026-08 redesign)

Canvas: https://claude.ai/code/artifact/acd3201d-4e4e-4428-a698-678509199bc9 — sources in
`design/*.dc.html` + `canvas.json` (`design/gamenight-compass-redesign.html` is a generated,
gitignored artifact — re-seed/republish to the same canvas URL, don't hand-edit). Canvas covers
visual language/layout only; BGG links, box art, playtime, sort modes were built directly in the
app afterward and aren't reflected in the canvas mockups.

## Two visual languages — do not mix

- **Quality** (how well a game plays at a player count) = the only thing colored badges/letters
  mean. Continuous red→green ramp, CSS vars `--q-S`..`--q-F` per theme in `app.css`. Band headers
  use the filled-disc `QualityBadge`; per-count boxes/cells color their letter via `qualityColor`.
- **Difficulty/teach time** = row/card backdrop wash only (`--wash-S`..`--wash-F`, green→red) via
  `teachWash`. No text label or letter for it in a row/card (dropped — the wash already carries
  it). `TIER_DESC` wording (`"instant"`, `"~10 min"`, ...) surfaces only in the teach-gate filter
  chips in `Filters.tsx`. Never render teach time as a letter badge — owner rejected that.

## Views and themes

- Header toggles: Card View/List View (`CardsIcon`/`ListIcon`), Light/Dark Mode
  (`SunIcon`/`MoonIcon`). All 4 combos first-class. State: localStorage `gn-view`/`gn-theme`.
  **Default: cards + dark** (flipped from canvas's original light/list — don't revert without
  asking). Theme = `html[data-theme]`; every color/font is an `app.css` token.
- Light = "paper" (Libre Franklin + Courier Prime, cream + vermillion `#c33d22`).
  Dark = "scoreboard" (Barlow Condensed + Barlow + JetBrains Mono, near-black + amber `#f59e0b`).

## Shelf structure

- Count selected → games band by `pc[count]` (`QUALITY_LABEL`: Great/Very good/Fine/
  Stretched/Rough/Avoid). No count → one "whole shelf" band.
- Sort is a first-class control: `sort-toggle` segmented control (Random/Rank/Complexity/A-Z) on
  the first band, backed by `SortMode` in `types.ts`. Two independent modes: `sortMode`
  (localStorage `gn-sort`, default `random`) governs the unfiltered whole-shelf view;
  `countSortMode` (session-only, default `"complexity"` = easiest teach first) governs ordering
  within each band once a count is picked (makes the wash read as a gradient down a band).
  "Random" = stable per-page-load shuffle (`randomWeights`, seeded once via `useMemo`, no
  re-shuffle on re-render). "Rank" = `rankScore`, mean tier-rank across all supported counts
  (lower = better).
- Search overrides every other filter (`handleSearchChange` clears count/vibe/gate on type) —
  intentional: with 99 games there's no value combining search with other filters.
- Dice roll only pulls from S-tier at the active count once a count is selected (`rollPool` in
  `App.tsx`) — a roll with a count picked always lands on a great fit for that table size.

## Box art, BGG links, playtime — `Game` fields added post-canvas

`types.ts`/`schema.py` (`ALLOWED_KEYS`) carry 4 optional fields, backfilled off one BGG lookup by
`gamenight/research.py` (new entries) or `gamenight images`/`gamenight playtime` (existing ones)
— see [`research.md`](research.md) for the pipeline + `BGG_API_TOKEN` requirement:

- **`image`** — BGG-hosted URL, source of truth. **`imageLocal`** — optional gitignored local
  cache under `frontend/public/images/`, preferred when present (`imageLocal || image`
  everywhere). Both fall back `imageLocal` → `image` → hide on load error (`handleArtError`).
- **`bggId`** — makes a card tile clickable to the game's BGG page (desktop only; on mobile the
  tap surface is used by note-expand, so a corner link icon handles it — `card-bgg-link` /
  `ExternalLinkIcon` in `GameCard.tsx`).
- **`time`** — per-count playtime in minutes via `playtimeText()` (exact minutes for selected
  count, else full range). Occupies the "teach" column position in list view / image-overlay
  corner in card view — it is playtime, NOT teach difficulty; don't rename back to "teach".

## Card vs. row: different click models — don't unify

- **List rows** (`GameRow.tsx`): one big `<button>`, click anywhere toggles an App-controlled
  `expanded` note (lifted state).
- **Cards** (`GameCard.tsx`): not buttons, manage own `expanded` state locally. Clicking card body
  navigates to BGG (if `bggId` present and viewport ≥720px); clicking note text toggles expand,
  only when the note is actually truncated (`useLayoutEffect` measures `scrollHeight` vs
  `clientHeight`). Two deliberately different interaction models — not an inconsistency to fix.

## Open/standing items

- S badge color: currently Variant 1 (deepest ramp green). A breakout color (ink `#241d12`, teal
  `#0f6b74`, brass `#a67c00`) is a one-line `--q-S` change per theme in `app.css` (samples on
  canvas) if the owner asks.
- `constants.ts` holds vocabulary (synced with `gamenight/schema.py`) + tier/sort/format helpers
  (`byTeachWeight`, `byName`, `byRank`/`rankScore`, `playtimeText`); colors/washes live only in
  `app.css` tokens — never hardcode a hex in a component.
