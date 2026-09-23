export type Tier = "S" | "A" | "B" | "C" | "D" | "F";

export interface Game {
  name: string;
  /** Learnability tier for a fresh table (S = instant … F = very heavy). */
  learn: Tier;
  /** Optional: learnability once expansions / advanced content is in play. */
  learnExp?: Tier;
  /** Player count → how well the game plays at that count. Keys are strings ("2"). */
  pc: Record<string, Tier>;
  vibes: string[];
  /** Human-readable sweet spot, e.g. "2p", "3-4p", "6-10p", "Any count". */
  sweet: string;
  note: string;
  /** Optional BGG-hosted box art URL (source of truth). */
  image?: string;
  /** Optional gitignored local cache of `image`, served from /images/ - preferred when present. */
  imageLocal?: string;
  /** Optional BoardGameGeek numeric id - links a tile to https://boardgamegeek.com/boardgame/<id>. */
  bggId?: string;
  /** Optional per-player-count typical playtime in minutes, BGG-anchored + interpolated. Keys are strings ("2"). */
  time?: Record<string, number>;
}

/** Shelf presentation: dense table rows or tile cards. */
export type View = "list" | "cards";
/** Material: paper (light) or scoreboard (dark). */
export type Theme = "light" | "dark";
/** Ordering for the unfiltered ("Any" player count) shelf view. */
export type SortMode = "random" | "rank" | "complexity" | "name";
