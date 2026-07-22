import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Standard Vite + React SPA. Vercel auto-detects this (framework preset "Vite")
// and needs no custom configuration: build -> `dist`, output is fully static.
export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2020",
    // Three.js is large; raise the warning limit so the build log stays clean.
    chunkSizeWarningLimit: 1600,
  },
});
