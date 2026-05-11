// Node.js build config for Railway / any Node.js host
// Run with: vite build --config vite.config.railway.ts
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  cloudflare: false,
  vite: {
    server: {
      port: Number(process.env.PORT) || 3000,
      host: "0.0.0.0",
    },
  },
});
