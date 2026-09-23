import type { SyntheticEvent } from "react";
import type { Game } from "../types";
import { COUNTS, playtimeText, qualityColor, teachWash } from "../constants";

interface Props {
  game: Game;
  countFilter: number | null;
  picked: boolean;
  expanded: boolean;
  onToggle: () => void;
}

// Local cache (imageLocal) first; on failure fall back to the BGG URL (image);
// on that failing too, hide the art rather than show a broken-image icon.
function handleArtError(e: SyntheticEvent<HTMLImageElement>, remote?: string) {
  const img = e.currentTarget;
  if (remote && img.src !== remote) {
    img.src = remote;
  } else {
    img.style.display = "none";
  }
}

/** List-view row: name | teach | per-count quality letters | sweet | vibes. */
export default function GameRow({ game, countFilter, picked, expanded, onToggle }: Props) {
  return (
    <button
      className={`row${picked ? " is-picked" : ""}`}
      onClick={onToggle}
      aria-expanded={expanded}
    >
      {(game.imageLocal || game.image) && (
        <img
          className="row-art"
          src={game.imageLocal ? `/${game.imageLocal}` : game.image}
          alt=""
          loading="lazy"
          onError={(e) => handleArtError(e, game.image)}
        />
      )}
      <div className="row-body" style={{ background: teachWash(game.learn) }}>
        <div className="row-grid">
          <div className="row-name">
            {picked && <span className="picked-tag mono">pick</span>}
            {game.name}
          </div>
          <div className="row-meta">
            <div className="row-teach mono">{playtimeText(game, countFilter)}</div>
            <div className="row-sweet mono">{game.sweet}</div>
          </div>
          <div className="row-counts mono">
            {COUNTS.map((c) => {
              const t = game.pc[String(c)];
              return (
                <span
                  key={c}
                  className={`cell${countFilter === c ? " is-col" : ""}${t ? "" : " is-empty"}`}
                  data-count={c}
                  style={t ? { color: qualityColor(t) } : undefined}
                >
                  {t ?? "·"}
                </span>
              );
            })}
          </div>
          <div className="row-vibes mono">{game.vibes.map((v) => v.toLowerCase()).join(" · ")}</div>
        </div>
        {expanded && (
          // Mounted only while open - a collapsed state that doesn't exist in the DOM
          // can't get stuck "stranded open" the way an animated max-height/grid-rows
          // collapse can on some mobile browsers.
          <div className="note is-open">
            <div className="note-inner">
              <p className="note-text">{game.note}</p>
              <div className="note-vibes mono">{game.vibes.map((v) => v.toLowerCase()).join(" · ")}</div>
            </div>
          </div>
        )}
      </div>
    </button>
  );
}
