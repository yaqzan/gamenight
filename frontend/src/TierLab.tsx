import { useEffect, useMemo, useState } from "react";
import gamesJson from "virtual:games";
import type { Game, Tier } from "./types";
import { QUALITY_LABEL, tierRank } from "./constants";

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

/** Bell: force every tier to a fixed share of the pool, ranked by hand tier then signal. */
const BELL: [Tier, number][] = [["S", 0.1], ["A", 0.2], ["B", 0.4], ["C", 0.2], ["D", 0.1]];
function bell(pool: Game[], count: number, signal: Signal): Placed[] {
  const key = String(count);
  const sig = (g: Game) => signal[g.name]?.[key] ?? 0.5;
  const ranked = [...pool].sort(
    (a, b) => tierRank(a.pc[key]) - tierRank(b.pc[key]) || sig(b) - sig(a) || a.name.localeCompare(b.name),
  );
  const n = ranked.length;
  const quota = BELL.map(([, share]) => Math.round(share * n));
  quota[2] += n - quota.reduce((x, y) => x + y, 0);
  const out: Placed[] = [];
  let i = 0;
  BELL.forEach(([t], k) => {
    for (const g of ranked.slice(i, i + quota[k])) out.push({ game: g, hand: g.pc[key], proposed: t });
    i += quota[k];
  });
  return out;
}

type Mode = "current" | "cap" | "bell";
const MODE_NOTE: Record<Mode, string> = {
  current: "your hand-set tiers",
  cap: "S/A capped",
  bell: "forced bell: S10 A20 B40 C20 D10",
};

const delta = (p: Placed) => Math.abs(tierRank(p.hand) - tierRank(p.proposed));

function Tile({ p, mode }: { p: Placed; mode: Mode }) {
  const g = p.game;
  const src = g.imageLocal ? `/${g.imageLocal}` : g.image;
  const moved = mode !== "current" && p.hand !== p.proposed;
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

function Pool({ title, placed, mode }: { title: string; placed: Placed[]; mode: Mode }) {
  const tierOf = (p: Placed) => (mode === "current" ? p.hand : p.proposed);
  const moved = placed.filter((p) => p.hand !== p.proposed);
  const big = moved.filter((p) => delta(p) >= 2);
  const toB = placed.filter((p) => (p.hand === "S" || p.hand === "A") && p.proposed === "B").length;
  return (
    <section className="tl-pool">
      <div className="tl-pool-head">{title}</div>
      <div className="tl-pool-sub">
        {placed.length} games ·{" "}
        {mode === "current" ? MODE_NOTE.current : `${MODE_NOTE[mode]} · ${moved.length} move, ${big.length} by 2+ tiers · ${toB} S/A games fall to B`}
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
      {mode !== "current" && moved.length > 0 && (
        <div className="tl-moves">{moved.map((p) => `${p.game.name} ${p.hand}→${p.proposed}`).join(" · ")}</div>
      )}
    </section>
  );
}

// Remembered across toggling to the shelf and back (module scope outlives the component).
const saved = { mode: "cap" as Mode, sCap: 0.15, aCap: 0.45 };

export default function TierLab({ count }: { count: number }) {
  const [mode, setMode] = useState<Mode>(saved.mode);
  const [sCap, setSCap] = useState(saved.sCap);
  const [aCap, setACap] = useState(saved.aCap);
  saved.mode = mode;
  saved.sCap = sCap;
  saved.aCap = aCap;
  const [signal, setSignal] = useState<Signal>({});

  useEffect(() => {
    fetch("/tierlab-signal.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then(setSignal)
      .catch(() => undefined);
  }, []);

  const { main: mainPool, party: partyPool } = useMemo(() => {
    const at = GAMES.filter((g) => g.pc[String(count)]);
    const isParty = (g: Game) => g.vibes.includes("Party");
    return {
      main: at.filter((g) => !isParty(g)),
      party: at.filter(isParty),
    };
  }, [count]);
  const place = (pool: Game[]) => (mode === "bell" ? bell(pool, count, signal) : propose(pool, count, sCap, aCap, signal));

  return (
    <>
      <div className="tl-ctl">
        <div className="seg" role="group" aria-label="Mode">
          {(["current", "cap", "bell"] as const).map((m) => (
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
      <Pool title={`Main shelf at ${count}p`} placed={place(mainPool)} mode={mode} />
      {partyPool.length > 0 && <Pool title={`Party bracket at ${count}p`} placed={place(partyPool)} mode={mode} />}
    </>
  );
}
