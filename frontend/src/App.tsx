import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gamesJson from "virtual:games";
import type { Game, SortMode, Theme, Tier, View } from "./types";
import { COUNTS, QUALITY_LABEL, TIER_ORDER, byName, byTeachWeight, rankScore, tierLte, tierRank } from "./constants";
import Filters from "./components/Filters";
import PickBanner from "./components/PickBanner";
import GameCard from "./components/GameCard";
import GameRow from "./components/GameRow";
import QualityBadge from "./components/QualityBadge";
import DieIcon from "./components/DieIcon";

const GAMES = gamesJson as Game[];
const SITE_HOST = import.meta.env.VITE_SITE_URL?.replace(/^https?:\/\//, "");

function readStored<T extends string>(key: string, fallback: T, valid: readonly T[]): T {
  const v = window.localStorage.getItem(key);
  return v !== null && (valid as readonly string[]).includes(v) ? (v as T) : fallback;
}

interface Band {
  tier: Tier | null;
  games: Game[];
}

function CardsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" />
      <line x1="12" y1="1.5" x2="12" y2="4.5" />
      <line x1="12" y1="19.5" x2="12" y2="22.5" />
      <line x1="1.5" y1="12" x2="4.5" y2="12" />
      <line x1="19.5" y1="12" x2="22.5" y2="12" />
      <line x1="4.4" y1="4.4" x2="6.5" y2="6.5" />
      <line x1="17.5" y1="17.5" x2="19.6" y2="19.6" />
      <line x1="4.4" y1="19.6" x2="6.5" y2="17.5" />
      <line x1="17.5" y1="6.5" x2="19.6" y2="4.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.2 14.9A8.5 8.5 0 1 1 9.1 3.8a7 7 0 0 0 11.1 11.1z" />
    </svg>
  );
}

function Logo() {
  return (
    <svg className="logo-mark" width="32" height="32" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="2 7" strokeLinecap="round" opacity="0.8" />
      <g transform="rotate(45 32 32)">
        <rect x="18" y="18" width="28" height="28" rx="6" fill="var(--accent)" />
        <g fill="var(--bg)">
          <circle cx="25" cy="25" r="2.6" />
          <circle cx="39" cy="25" r="2.6" />
          <circle cx="32" cy="32" r="2.6" />
          <circle cx="25" cy="39" r="2.6" />
          <circle cx="39" cy="39" r="2.6" />
        </g>
      </g>
    </svg>
  );
}

export default function App() {
  const [view, setView] = useState<View>(() => readStored("gn-view", "cards", ["list", "cards"] as const));
  const [theme, setTheme] = useState<Theme>(() => readStored("gn-theme", "dark", ["light", "dark"] as const));
  const [countFilter, setCountFilter] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>(() =>
    readStored("gn-sort", "random", ["random", "rank", "complexity", "name"] as const)
  );
  // Separate from sortMode: the count-filtered view defaults to difficulty order
  // (matching each tier band's existing behavior) regardless of the whole-shelf sort.
  const [countSortMode, setCountSortMode] = useState<SortMode>("complexity");
  // Stable per-load shuffle weights so "Random" order doesn't reshuffle on every re-render.
  const randomWeights = useMemo(() => new Map(GAMES.map((g) => [g.name, Math.random()])), []);
  const [vibeFilter, setVibeFilter] = useState<string[]>([]);
  const [learnGate, setLearnGate] = useState<Tier>("F");
  const [search, setSearch] = useState("");
  const [randomPick, setRandomPick] = useState<Game | null>(null);
  const [rolling, setRolling] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const rollTimer = useRef<number | null>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("gn-theme", theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem("gn-view", view);
  }, [view]);

  useEffect(() => {
    window.localStorage.setItem("gn-sort", sortMode);
  }, [sortMode]);

  // Searching overrides every other filter — not enough games here to justify combining them.
  const filtered = useMemo(() => {
    if (search) {
      const q = search.toLowerCase();
      return GAMES.filter((g) => g.name.toLowerCase().includes(q));
    }
    return GAMES.filter((g) => {
      if (countFilter !== null && !g.pc[String(countFilter)]) return false;
      if (vibeFilter.length > 0 && !vibeFilter.some((v) => g.vibes.includes(v))) return false;
      if (!tierLte(g.learn, learnGate)) return false;
      return true;
    });
  }, [countFilter, vibeFilter, learnGate, search]);

  // Band the shelf by per-count quality; inside a band, sort by the active sort mode.
  const bands = useMemo<Band[]>(() => {
    const byShuffle = (a: Game, b: Game) => (randomWeights.get(a.name) ?? 0) - (randomWeights.get(b.name) ?? 0);
    if (countFilter === null) {
      const comparator: (a: Game, b: Game) => number =
        sortMode === "name"
          ? byName
          : sortMode === "rank"
            ? (a, b) => rankScore(a) - rankScore(b) || byShuffle(a, b)
            : sortMode === "complexity"
              ? (a, b) => tierRank(a.learn) - tierRank(b.learn) || byShuffle(a, b)
              : byShuffle;
      const sorted = [...filtered].sort(comparator);
      return sorted.length > 0 ? [{ tier: null, games: sorted }] : [];
    }
    const comparator: (a: Game, b: Game) => number =
      countSortMode === "name"
        ? byName
        : countSortMode === "rank"
          ? (a, b) => rankScore(a) - rankScore(b) || byName(a, b)
          : countSortMode === "random"
            ? byShuffle
            : byTeachWeight; // "complexity" (default) - easiest teach first
    return TIER_ORDER.map((t) => ({
      tier: t as Tier | null,
      games: filtered.filter((g) => g.pc[String(countFilter)] === t).sort(comparator),
    })).filter((b) => b.games.length > 0);
  }, [filtered, countFilter, sortMode, countSortMode, randomWeights]);

  useEffect(() => {
    return () => {
      if (rollTimer.current !== null) window.clearInterval(rollTimer.current);
    };
  }, []);

  // With a player count selected, only S-tier games at that count are worth rolling for.
  const rollPool = useMemo(() => {
    if (countFilter === null) return filtered;
    return filtered.filter((g) => g.pc[String(countFilter)] === "S");
  }, [filtered, countFilter]);

  const rollRandom = useCallback(() => {
    if (rollPool.length === 0 || rolling) return;
    setRolling(true);
    setExpanded(null);
    let ticks = 0;
    if (rollTimer.current !== null) window.clearInterval(rollTimer.current);
    rollTimer.current = window.setInterval(() => {
      ticks += 1;
      setRandomPick(rollPool[Math.floor(Math.random() * rollPool.length)]);
      if (ticks >= 18) {
        if (rollTimer.current !== null) window.clearInterval(rollTimer.current);
        setRolling(false);
      }
    }, 75);
  }, [rollPool, rolling]);

  // Once the roll settles, make sure the pick banner is on screen (mobile).
  useEffect(() => {
    if (!rolling && randomPick) {
      bannerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [rolling, randomPick]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (value) {
      setCountFilter(null);
      setVibeFilter([]);
      setLearnGate("F");
    }
  };

  const toggleVibe = (v: string) =>
    setVibeFilter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  const activeFilters = vibeFilter.length + (learnGate !== "F" ? 1 : 0);
  const activeSortMode = countFilter === null ? sortMode : countSortMode;
  const setActiveSortMode = countFilter === null ? setSortMode : setCountSortMode;

  const bandTitle = (tier: Tier | null): string =>
    tier === null ? "The whole shelf" : `${QUALITY_LABEL[tier]} at ${countFilter} player${countFilter === 1 ? "" : "s"}`;

  const sortSubLabel: Record<SortMode, string> = {
    random: "shuffled",
    rank: "top rated first",
    complexity: "simplest first",
    name: "a-z",
  };

  const bandSub = (b: Band): string =>
    b.tier === null
      ? `${b.games.length} games · ${sortSubLabel[sortMode]}`
      : `${b.games.length} games rate ${b.tier} at ${countFilter}p`;

  const renderItems = (games: Game[]) =>
    view === "cards" ? (
      <div className="grid">
        {games.map((g) => (
          <GameCard
            key={g.name}
            game={g}
            countFilter={countFilter}
            picked={!rolling && randomPick?.name === g.name}
          />
        ))}
      </div>
    ) : (
      <div className="rows">
        <div className="row-grid list-head mono" aria-hidden="true">
          <span>game</span>
          <span>time</span>
          <span className="row-counts">
            {COUNTS.map((c) => (
              <span key={c} className={`cell${countFilter === c ? " is-col-head" : ""}`}>
                {c}
              </span>
            ))}
          </span>
          <span>sweet</span>
          <span className="row-vibes">vibes</span>
        </div>
        {games.map((g) => (
          <GameRow
            key={g.name}
            game={g}
            countFilter={countFilter}
            picked={!rolling && randomPick?.name === g.name}
            expanded={expanded === g.name}
            onToggle={() => setExpanded(expanded === g.name ? null : g.name)}
          />
        ))}
      </div>
    );

  return (
    <div>
      <header className="hdr">
        <div className="wrap hdr-inner">
          <h1 className="logo">
            <Logo /> Game Night Compass
          </h1>
          <div className="hdr-search-wrap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <line x1="15.5" y1="15.5" x2="20.5" y2="20.5" />
            </svg>
            <input
              className="hdr-search mono"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="search the shelf…"
              type="text"
              autoComplete="off"
            />
            {search && (
              <button
                className="hdr-search-clear"
                aria-label="Clear search"
                title="Clear search"
                onClick={() => handleSearchChange("")}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <line x1="5" y1="5" x2="19" y2="19" />
                  <line x1="19" y1="5" x2="5" y2="19" />
                </svg>
              </button>
            )}
          </div>
          <div className="hdr-actions">
            <div className="seg seg-icon" role="group" aria-label="View">
              <button
                className={view === "cards" ? "is-on" : ""}
                aria-pressed={view === "cards"}
                aria-label="Card view"
                title="Card view"
                onClick={() => setView("cards")}
              >
                <CardsIcon />
              </button>
              <button
                className={view === "list" ? "is-on" : ""}
                aria-pressed={view === "list"}
                aria-label="List view"
                title="List view"
                onClick={() => setView("list")}
              >
                <ListIcon />
              </button>
            </div>
            <div className="seg seg-icon" role="group" aria-label="Theme">
              <button
                className={theme === "light" ? "is-on" : ""}
                aria-pressed={theme === "light"}
                aria-label="Light mode"
                title="Light mode"
                onClick={() => setTheme("light")}
              >
                <SunIcon />
              </button>
              <button
                className={theme === "dark" ? "is-on" : ""}
                aria-pressed={theme === "dark"}
                aria-label="Dark mode"
                title="Dark mode"
                onClick={() => setTheme("dark")}
              >
                <MoonIcon />
              </button>
            </div>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="wrap hero-inner">
          <div className="hero-title">Which game tonight?</div>
          <div className="hero-picker-center">
            <div className="picker seg-hard" role="group" aria-label="Player count">
              <button className={`mono${countFilter === null ? " is-on" : ""}`} onClick={() => setCountFilter(null)}>
                Any
              </button>
              {COUNTS.map((c) => (
                <button
                  key={c}
                  className={`mono${countFilter === c ? " is-on" : ""}`}
                  onClick={() => setCountFilter(countFilter === c ? null : c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="hero-actions-group">
            <button className={`btn-roll${rolling ? " is-rolling" : ""}`} onClick={rollRandom} disabled={rollPool.length === 0}>
              <span className={rolling ? "roll-spin" : ""}>
                <DieIcon />
              </span>{" "}
              Roll the dice
            </button>
            <button
              className={`btn-ghost mono${filtersOpen ? " is-on" : ""}`}
              onClick={() => setFiltersOpen((o) => !o)}
              aria-expanded={filtersOpen}
            >
              filters{activeFilters > 0 ? ` · ${activeFilters}` : ""}
            </button>
          </div>
        </div>
      </section>

      <div className={`filters-collapse${filtersOpen ? " is-open" : ""}`}>
        <div className="filters-collapse-inner">
          <Filters
            learnGate={learnGate}
            onGate={setLearnGate}
            vibeFilter={vibeFilter}
            onToggleVibe={toggleVibe}
            onClearVibes={() => setVibeFilter([])}
          />
        </div>
      </div>

      <div ref={bannerRef}>
        {randomPick && <PickBanner pick={randomPick} rolling={rolling} onClear={() => setRandomPick(null)} />}
      </div>

      <main className="wrap main-wrap">
        {bands.length === 0 ? (
          <div className="empty">
            <div className="empty-die">
              <DieIcon size={44} />
            </div>
            <p className="empty-msg mono">No games match these filters. Try relaxing the teach gate or removing some vibes.</p>
          </div>
        ) : (
          bands.map((b, i) => (
            <section className="band" key={b.tier ?? "all"}>
              <div className="band-head">
                {b.tier !== null && <QualityBadge tier={b.tier} size={44} />}
                <div className="band-titles">
                  <div className="band-title">{bandTitle(b.tier)}</div>
                  <div className="band-sub mono">{bandSub(b)}</div>
                </div>
                <div className="band-rule" />
                {i === 0 && (
                  <div className="sort-toggle seg" role="group" aria-label="Sort">
                    <button
                      className={`mono${activeSortMode === "random" ? " is-on" : ""}`}
                      onClick={() => setActiveSortMode("random")}
                    >
                      Random
                    </button>
                    <button
                      className={`mono${activeSortMode === "rank" ? " is-on" : ""}`}
                      onClick={() => setActiveSortMode("rank")}
                    >
                      Rank
                    </button>
                    <button
                      className={`mono${activeSortMode === "complexity" ? " is-on" : ""}`}
                      onClick={() => setActiveSortMode("complexity")}
                    >
                      Complexity
                    </button>
                    <button
                      className={`mono${activeSortMode === "name" ? " is-on" : ""}`}
                      onClick={() => setActiveSortMode("name")}
                    >
                      A–Z
                    </button>
                  </div>
                )}
              </div>
              {renderItems(b.games)}
            </section>
          ))
        )}
      </main>

      <footer className="ftr mono">
        {GAMES.length} games · learnability &amp; player-count ratings from BGG polls, r/boardgames, and reviewer consensus
        <br />
        researched &amp; maintained with Claude{SITE_HOST && ` · ${SITE_HOST}`}
      </footer>

      <button className="fab" onClick={rollRandom} disabled={rollPool.length === 0} aria-label="Roll the dice">
        <span className={rolling ? "roll-spin" : ""}>
          <DieIcon size={24} />
        </span>
      </button>
    </div>
  );
}
