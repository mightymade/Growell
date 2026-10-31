import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Link previews (WhatsApp, Facebook, X) need the full address of the
 * preview image, not "/laptop.png". The live address comes from
 * VITE_SITE_URL if you set one, otherwise from Vercel, which tells every
 * build its main address. Locally nothing changes.
 */
function absoluteShareLinks(): Plugin {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const site = (process.env.VITE_SITE_URL || (vercel ? `https://${vercel}` : "")).replace(/\/$/, "");
  return {
    name: "absolute-share-links",
    transformIndexHtml(html) {
      if (!site) return html;
      return html
        .replace('content="/laptop.png"', `content="${site}/laptop.png"`)
        .replace("</head>", `  <meta property="og:url" content="${site}/" />\n  </head>`);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), absoluteShareLinks()],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        // Heavy libraries get their own files, so they are downloaded only
        // when a page needs them (charts on the field page, maps on the
        // field page and Add Field) and stay cached between app updates.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("recharts") || id.includes("/d3-") || id.includes("victory-vendor")) return "charts";
          if (id.includes("leaflet") || id.includes("@turf")) return "maps";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("@tanstack")) return "query";
          if (id.includes("react-router") || id.includes("react-dom") || id.includes("/react/") || id.includes("scheduler")) return "react";
        },
      },
    },
  },
});
