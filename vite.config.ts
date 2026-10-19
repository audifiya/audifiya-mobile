import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const isElectron = process.env.ELECTRON === "true";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },

    // Desktop build only: emit a static SPA shell (index.html) instead of a server-only app.
    // The web deployment (ELECTRON unset) is unchanged.
    ...(isElectron
      ? {
          spa: {
            enabled: true,
            prerender: { outputPath: "/index.html", crawlLinks: false },
          },
        }
      : {}),
  },
  // No `base: "./"` override needed: Electron serves the build through the app://
  // protocol (see electron/main.cjs), so normal absolute asset paths work.
});