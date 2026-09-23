import type { Tier } from "../types";
import { ALL_VIBES, TIER_DESC, TIER_ORDER, teachWash, tierLte } from "../constants";

interface Props {
  learnGate: Tier;
  onGate: (t: Tier) => void;
  vibeFilter: string[];
  onToggleVibe: (v: string) => void;
  onClearVibes: () => void;
}

export default function Filters(p: Props) {
  return (
    <section className="filters">
      <div className="wrap filters-inner">
        <div className="f-group">
          <p className="f-label mono">Vibe</p>
          <div className="chip-row">
            {ALL_VIBES.map((v) => {
              const on = p.vibeFilter.includes(v);
              return (
                <button key={v} className={`chip-vibe mono${on ? " is-on" : ""}`} onClick={() => p.onToggleVibe(v)}>
                  {v.toLowerCase()}
                </button>
              );
            })}
            {p.vibeFilter.length > 0 && (
              <button className="chip-vibe mono is-clear" onClick={p.onClearVibes}>
                clear
              </button>
            )}
          </div>
        </div>

        <div className="f-group">
          <p className="f-label mono">Teach gate — show games up to</p>
          <div className="chip-row">
            {TIER_ORDER.map((t) => {
              const on = tierLte(t, p.learnGate);
              const active = p.learnGate === t && t !== "F";
              return (
                <button
                  key={t}
                  className={`chip-gate mono${on ? " is-on" : ""}${active ? " is-active" : ""}`}
                  onClick={() => p.onGate(t)}
                >
                  <span className="gate-swatch" style={{ background: teachWash(t) }} />
                  {TIER_DESC[t]}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
