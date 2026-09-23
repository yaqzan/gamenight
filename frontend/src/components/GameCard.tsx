import { useLayoutEffect, useRef, useState, type SyntheticEvent } from "react";
import type { Game } from "../types";
import { playtimeText, qualityColor, teachWash } from "../constants";

interface Props {
  game: Game;
  countFilter: number | null;
  picked: boolean;
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

function openBgg(bggId: string) {
  window.open(`https://boardgamegeek.com/boardgame/${bggId}`, "_blank", "noopener,noreferrer");
}

function ExternalLinkIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 4h6v6" />
      <path d="M20 4 10 14" />
      <path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
    </svg>
  );
}

/** Card-view tile: name, sweet spot, supported-count boxes, player range + playtime, vibes, note. */
export default function GameCard({ game, countFilter, picked }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const noteRef = useRef<HTMLParagraphElement>(null);

  // Only the descriptions that actually overflow the 4-line clamp get the fade +
  // tap-to-expand treatment - a short note that already fits shouldn't look truncated.
  useLayoutEffect(() => {
    const el = noteRef.current;
    if (!el) return;
    const check = () => setTruncated(el.scrollHeight > el.clientHeight + 1);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [game.note]);

  const counts = Object.keys(game.pc)
    .map(Number)
    .sort((a, b) => a - b);
  const wash = teachWash(game.learn);
  const min = counts[0];
  const max = counts[counts.length - 1];
  const totalRange = min === max ? `${min}p` : `${min}-${max}p`;
  const timeRange = playtimeText(game, countFilter);

  return (
    <div
      className={`card${picked ? " is-picked" : ""}${game.bggId ? " card-linkable" : ""}${expanded ? " is-expanded" : ""}`}
      onClick={() => {
        // On mobile the corner icon handles BGG navigation instead - the whole tile
        // is busy being tappable for the description bubble.
        if (game.bggId && !window.matchMedia("(max-width: 719px)").matches) openBgg(game.bggId);
      }}
    >
      {picked && <div className="picked-tag card-picked-tag mono">tonight's pick</div>}
      {(game.imageLocal || game.image) ? (
        <div className="card-art-wrap">
          <img
            className="card-art"
            src={game.imageLocal ? `/${game.imageLocal}` : game.image}
            alt=""
            loading="lazy"
            onError={(e) => handleArtError(e, game.image)}
          />
          <div className="card-pcount mono">{totalRange}</div>
          <div className="card-sweet mono">{timeRange}</div>
        </div>
      ) : (
        <>
          <div className="card-pcount mono">{totalRange}</div>
          <div className="card-sweet mono">{timeRange}</div>
        </>
      )}
      <div className="card-body" style={{ backgroundImage: `linear-gradient(0deg, ${wash}, ${wash})` }}>
        {game.bggId && (
          <button
            className="card-bgg-link"
            aria-label="Open on BoardGameGeek"
            title="Open on BoardGameGeek"
            onClick={(e) => {
              e.stopPropagation();
              openBgg(game.bggId!);
            }}
          >
            <ExternalLinkIcon />
          </button>
        )}
        <div className="card-head">
          <div className="card-head-text">
            <h3 className="card-name">{game.name}</h3>
            <div className="card-sweet-label mono">sweet spot {game.sweet}</div>
          </div>
        </div>
        <div className="card-counts">
          {counts.map((c) => {
            const t = game.pc[String(c)];
            const active = countFilter === c;
            return (
              <span key={c} className={`pcbox${active ? " is-active" : ""}`}>
                <span className="pc-n mono">{c}</span>
                <span className="pc-t mono" style={{ color: qualityColor(t) }}>
                  {t}
                </span>
              </span>
            );
          })}
        </div>
        <div className="card-vibes mono">{game.vibes.map((v) => v.toLowerCase()).join(" · ")}</div>
        <div className={`note is-open${expanded ? " is-expanded" : ""}`}>
          <div className="note-inner">
            <p
              ref={noteRef}
              className={`note-text${expanded ? " is-expanded" : ""}${truncated ? " is-truncated" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!expanded && !truncated) return; // fully visible already - nothing to expand
                setExpanded((v) => !v);
              }}
            >
              {game.note}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
