import { useEffect, useMemo, useState } from "react";
import gamesJson from "virtual:games";
import type { Game, Tier } from "./types";
import { COUNTS, QUALITY_LABEL, tierRank } from "./constants";

// Experimental view at /#tierlab: the shelf as a classic tier list per player count, with S/A
// tightened by caps (% of the games at THAT count, party games curved in their own pool).
// Nothing here writes data: proposed tiers are computed in the browser from games.json.

const GAMES = gamesJson as Game[];
const SHOWN: Tier[] = ["S", "A", "B", "C", "D"];
type Signal = Record<string, Record<string, number>>;

interface Placed {
  game: Game;
  hand: Tier;
  proposed: Tier;
}

/** Cap S and A at a share of this pool's games. Rank = hand tier, then the BGG per-count signal.
 *  Only hand-S can be S and only hand-S/A can be A; overflow drops one band at a time. */
function propose(pool: Game[], count: number, sCap: number, aCap: number, signal: Signal): Placed[] {
  const key = String(count);
  const sig = (g: Game) => signal[g.name]?.[key] ?? 0.5;
  const ranked = [...pool].sort(
    (a, b) => tierRank(a.pc[key]) - tierRank(b.pc[key]) || sig(b) - sig(a) || a.name.localeCompare(b.name),
  );
  let sLeft = Math.round(sCap * pool.length);
  let aLeft = Math.round(aCap * pool.length);
  return ranked.map((g) => {
    const hand = g.pc[key];
    let proposed = hand;
    if (hand === "S" && sLeft > 0) {
      sLeft--;
    } else if (hand === "S" || hand === "A") {
      if (aLeft > 0) {
        aLeft--;
        proposed = "A";
      } else proposed = "B";
    }
    return { game: g, hand, proposed };
  });
}

const delta = (p: Placed) => Math.abs(tierRank(p.hand) - tierRank(p.proposed));

function Tile({ p, mode }: { p: Placed; mode: "current" | "proposed" }) {
  const g = p.game;
  const src = g.imageLocal ? `/${g.imageLocal}` : g.image;
  const moved = mode === "proposed" && p.hand !== p.proposed;
  const big = moved && delta(p) >= 2;
  return (
    <div
      className={`tl-tile${moved ? " is-moved" : ""}${big ? " is-big" : ""}`}
      title={`${g.name} (${p.hand}${moved ? ` → ${p.proposed}` : ""})`}
    >
      {src ? <img src={src} alt={g.name} loading="lazy" /> : <span>{g.name}</span>}
      {moved && (
        <span className="tl-delta">
          {p.hand}→{p.proposed}
        </span>
      )}
    </div>
  );
}

function Pool({ title, placed, mode }: { title: string; placed: Placed[]; mode: "current" | "proposed" }) {
  const tierOf = (p: Placed) => (mode === "current" ? p.hand : p.proposed);
  const moved = placed.filter((p) => p.hand !== p.proposed);
  const big = moved.filter((p) => delta(p) >= 2);
  return (
    <section className="tl-pool">
      <div className="tl-pool-head">{title}</div>
      <div className="tl-pool-sub">
        {placed.length} games ·{" "}
        {mode === "proposed" ? `${moved.length} move, ${big.length} by 2+ tiers` : "your hand-set tiers"}
      </div>
      {SHOWN.map((t) => {
        const row = placed.filter((p) => tierOf(p) === t);
        return (
          <div className="tl-row" key={t}>
            <div className="tl-label" style={{ background: `var(--q-${t})` }}>
              {t}
              <small>{row.length}</small>
            </div>
            <div className="tl-tiles">
              {row.map((p) => (
                <Tile key={p.game.name} p={p} mode={mode} />
              ))}
            </div>
          </div>
        );
      })}
      {mode === "proposed" && moved.length > 0 && (
        <div className="tl-moves">{moved.map((p) => `${p.game.name} ${p.hand}→${p.proposed}`).join(" · ")}</div>
      )}
    </section>
  );
}

export default function TierLab() {
  const [count, setCount] = useState(3);
  const [mode, setMode] = useState<"current" | "proposed">("proposed");
  const [sCap, setSCap] = useState(0.15);
  const [aCap, setACap] = useState(0.25);
  const [signal, setSignal] = useState<Signal>({});

  useEffect(() => {
    document.documentElement.dataset.theme = window.localStorage.getItem("gn-theme") === "light" ? "light" : "dark";
    fetch("/tierlab-signal.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then(setSignal)
      .catch(() => undefined);
  }, []);

  const { main, party } = useMemo(() => {
    const at = GAMES.filter((g) => g.pc[String(count)]);
    const isParty = (g: Game) => g.vibes.includes("Party");
    return {
      main: propose(at.filter((g) => !isParty(g)), count, sCap, aCap, signal),
      party: propose(at.filter(isParty), count, sCap, aCap, signal),
    };
  }, [count, sCap, aCap, signal]);

  return (
    <main className="wrap main-wrap">
      <h1 className="logo">Tier lab</h1>
      <div className="tl-ctl">
        <div className="picker seg-hard" role="group" aria-label="Player count">
          {COUNTS.map((c) => (
            <button key={c} className={`mono${count === c ? " is-on" : ""}`} onClick={() => setCount(c)}>
              {c}
            </button>
          ))}
        </div>
        <div className="seg" role="group" aria-label="Mode">
          {(["current", "proposed"] as const).map((m) => (
            <button key={m} className={`mono${mode === m ? " is-on" : ""}`} onClick={() => setMode(m)}>
              {m}
            </button>
          ))}
        </div>
        <label>
          S cap {Math.round(sCap * 100)}%
          <input type="range" min={5} max={40} value={Math.round(sCap * 100)} onChange={(e) => setSCap(+e.target.value / 100)} />
        </label>
        <label>
          A cap {Math.round(aCap * 100)}%
          <input type="range" min={5} max={50} value={Math.round(aCap * 100)} onChange={(e) => setACap(+e.target.value / 100)} />
        </label>
      </div>
      <p className="tl-pool-sub">
        Caps are shares of the games at {count}p in each pool. Order inside a tier: your hand tier, then BGG poll fit and
        rating. {SHOWN.map((t) => `${t} ${QUALITY_LABEL[t]}`).join(" · ")}. Outlined tiles moved; red tag = 2+ tiers.
      </p>
      <Pool title={`Main shelf at ${count}p`} placed={main} mode={mode} />
      {party.length > 0 && <Pool title={`Party bracket at ${count}p`} placed={party} mode={mode} />}
    </main>
  );
}
