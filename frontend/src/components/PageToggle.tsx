/** Header toggle between the shelf (original) and the experimental tier-list view (#tierlab). */
function ShelfIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 4h18M3 12h18M3 20h18" />
      <rect x="5" y="5.5" width="4" height="5" rx="0.8" />
      <rect x="11" y="5.5" width="4" height="5" rx="0.8" />
      <rect x="6" y="13.5" width="4" height="5" rx="0.8" />
      <rect x="12" y="13.5" width="4" height="5" rx="0.8" />
    </svg>
  );
}

function TierIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="2" y="3" width="5" height="5" rx="1" />
      <rect x="9" y="3" width="3.5" height="5" rx="1" opacity="0.55" />
      <rect x="14" y="3" width="3.5" height="5" rx="1" opacity="0.55" />
      <rect x="2" y="10" width="5" height="5" rx="1" />
      <rect x="9" y="10" width="3.5" height="5" rx="1" opacity="0.55" />
      <rect x="2" y="17" width="5" height="5" rx="1" />
      <rect x="9" y="17" width="3.5" height="5" rx="1" opacity="0.55" />
      <rect x="14" y="17" width="3.5" height="5" rx="1" opacity="0.55" />
      <rect x="19" y="17" width="3" height="5" rx="1" opacity="0.55" />
    </svg>
  );
}

export default function PageToggle({ page }: { page: "shelf" | "tiers" }) {
  return (
    <div className="seg seg-icon" role="group" aria-label="Page">
      <button
        className={page === "shelf" ? "is-on" : ""}
        aria-pressed={page === "shelf"}
        aria-label="Shelf"
        title="Shelf (original)"
        onClick={() => { if (page !== "shelf") window.location.hash = ""; }}
      >
        <ShelfIcon />
      </button>
      <button
        className={page === "tiers" ? "is-on" : ""}
        aria-pressed={page === "tiers"}
        aria-label="Tier list"
        title="Tier list view"
        onClick={() => { if (page !== "tiers") window.location.hash = "tierlab"; }}
      >
        <TierIcon />
      </button>
    </div>
  );
}
