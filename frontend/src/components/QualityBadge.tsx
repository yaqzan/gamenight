import type { Tier } from "../types";
import { qualityColor } from "../constants";

/** Filled gradient disc — the per-player-count quality mark. */
export default function QualityBadge({ tier, size = 44 }: { tier: Tier; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="29" fill={qualityColor(tier)} />
      <text x="32" y="34" textAnchor="middle" dominantBaseline="central" className="badge-letter">
        {tier}
      </text>
    </svg>
  );
}
