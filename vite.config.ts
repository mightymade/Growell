import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
