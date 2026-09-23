import type { Game } from "../types";
import { TIER_DESC, qualityColor } from "../constants";

interface Props {
  pick: Game;
  rolling: boolean;
  onClear: () => void;
}

export default function PickBanner({ pick, rolling, onClear }: Props) {
  const entries = Object.entries(pick.pc).sort(([a], [b]) => Number(a) - Number(b));
  return (
    <section className="banner">
      <div className="wrap banner-inner">
        <div className="banner-eyebrow mono">
          <span>{rolling ? "rolling…" : "tonight's pick"}</span>
          {!rolling && (
            <button className="banner-x" onClick={onClear} aria-label="Clear pick">
              ✕
            </button>
          )}
        </div>
        <div className="banner-body">
          {(pick.imageLocal || pick.image) && (
            <img
              className="banner-art"
              src={pick.imageLocal ? `/${pick.imageLocal}` : pick.image}
              alt=""
              onError={(e) => {
                if (pick.image && e.currentTarget.src !== pick.image) e.currentTarget.src = pick.image;
                else e.currentTarget.style.display = "none";
              }}
            />
          )}
          <div className="banner-text">
            <div className="banner-main">
              <div className="banner-name">{pick.name}</div>
              <div className="banner-learn mono">
                {TIER_DESC[pick.learn]} teach
                {pick.learnExp ? ` · exp: ${TIER_DESC[pick.learnExp]}` : ""}
                {" · sweet spot "}
                {pick.sweet}
              </div>
              <div className="banner-pcs">
                {entries.map(([c, t]) => (
                  <span key={c} className="pcbox">
                    <span className="pc-n mono">{c}</span>
                    <span className="pc-t mono" style={{ color: qualityColor(t) }}>
                      {t}
                    </span>
                  </span>
                ))}
              </div>
            </div>
            {!rolling && <div className="banner-note">{pick.note}</div>}
          </div>
        </div>
      </div>
    </section>
  );
}
