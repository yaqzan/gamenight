import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// data/games.json is your shelf (gitignored); a fresh clone builds from the
// example shelf until `python -m gamenight init` creates it.
const shelf = fileURLToPath(new URL("../data/games.json", import.meta.url));
const example = fileURLToPath(new URL("../examples/games.json", import.meta.url));
const gamesFile = existsSync(shelf) ? shelf : example;

// og:url only when VITE_SITE_URL is set (frontend/.env.local), so a clone never
// advertises someone else's domain.
function siteUrl(url: string | undefined): Plugin {
  return {
    name: "gamenight-site-url",
    transformIndexHtml: (html) =>
      url ? html.replace("</head>", `  <meta property="og:url" content="${url}/" />\n  </head>`) : html,
  };
}

export default defineConfig(({ mode }) => {
  if (gamesFile === example) console.warn("gamenight: no data/games.json - building the example shelf");
  const env = loadEnv(mode, process.cwd());
  return {
    plugins: [react(), siteUrl(env.VITE_SITE_URL)],
    resolve: { alias: { "virtual:games": gamesFile } },
    server: {
      // games.json lives outside frontend/ (../data or ../examples), shared
      // with the research pipeline - allow the dev server to read it.
      fs: { allow: [".."] },
    },
  };
});
