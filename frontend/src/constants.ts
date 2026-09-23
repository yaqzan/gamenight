import type { Tier } from "./types";

// Keep this file in sync with gamenight/schema.py (the research pipeline's
// copy of the same vocabulary): TIER_ORDER, the tier meanings, and the vibe
// vocabulary must match. Colors are UI-only and live in app.css per theme.

export const TIER_ORDER: Tier[] = ["S", "A", "B", "C", "D", "F"];

/** Learnability tier → how long it takes to get a fresh table playing. */
export const TIER_DESC: Record<Tier, string> = {
  S: "instant",
  A: "~10 min",
  B: "~30 min",
  C: "experienced",
  D: "heavy rulebook",
  F: "very heavy",
};

/** Per-count quality tier → band wording ("Great at 4 players"). */
export const QUALITY_LABEL: Record<Tier, string> = {
  S: "Great",
  A: "Very good",
  B: "Fine",
  C: "Stretched",
  D: "Rough",
  F: "Avoid",
};

/** Sync with gamenight/schema.py VIBES. */
export const ALL_VIBES = [
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
];

export const COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12];

export const tierRank = (t: Tier): number => TIER_ORDER.indexOf(t);
export const tierLte = (t: Tier, max: Tier): boolean => tierRank(t) <= tierRank(max);

/** Easiest-to-heaviest ordering inside a band, then by name. */
export const byTeachWeight = (a: { learn: Tier; name: string }, b: { learn: Tier; name: string }): number =>
  tierRank(a.learn) - tierRank(b.learn) || a.name.localeCompare(b.name);

/** Alphabetical, A-Z. */
export const byName = (a: { name: string }, b: { name: string }): number => a.name.localeCompare(b.name);

/** Overall rank score: average per-count quality tier (lower = better; S=0 .. F=5). */
export const rankScore = (g: { pc: Record<string, Tier> }): number => {
  const tiers = Object.values(g.pc);
  return tiers.reduce((sum, t) => sum + tierRank(t), 0) / tiers.length;
};

/** Best overall first, then by name. */
export const byRank = (a: { pc: Record<string, Tier>; name: string }, b: { pc: Record<string, Tier>; name: string }): number =>
  rankScore(a) - rankScore(b) || a.name.localeCompare(b.name);

/** Under an hour: "45m". An hour or more: rounded to the nearest half hour, "1h" / "1.5h" / "2h". */
const formatMinutes = (mins: number): string => {
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 30) * 30 / 60;
  return `${hours % 1 === 0 ? hours : hours.toFixed(1)}h`;
};

/** Typical playtime text: exact count if selected, else the full range across supported counts.
 * Falls back to a dash for the rare game with no playtime data — never the teach-time text,
 * which reads like a duration ("instant") but isn't one. */
export const playtimeText = (game: { time?: Record<string, number> }, countFilter: number | null): string => {
  const time = game.time;
  if (!time || Object.keys(time).length === 0) return "—";
  if (countFilter !== null && time[String(countFilter)] != null) {
    return formatMinutes(time[String(countFilter)]);
  }
  const values = Object.values(time);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return formatMinutes(min);
  if (max < 60) return `${min}-${max}m`; // both under an hour: skip the duplicate unit
  return `${formatMinutes(min)}-${formatMinutes(max)}`;
};

/** Quality badge/letter color for a tier — resolved per theme in app.css. */
export const qualityColor = (t: Tier): string => `var(--q-${t})`;
/** Teach-time backdrop wash for a learn tier — resolved per theme in app.css. */
export const teachWash = (t: Tier): string => `var(--wash-${t})`;
