/// <reference types="vite/client" />

// Resolved in vite.config.ts to data/games.json, or examples/games.json on a fresh clone.
declare module "virtual:games" {
  const games: unknown;
  export default games;
}

interface ImportMetaEnv {
  /** Public URL of your deployment, e.g. https://games.example.com (no trailing slash). Optional. */
  readonly VITE_SITE_URL?: string;
}
