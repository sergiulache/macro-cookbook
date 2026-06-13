import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages project site is served from /macro-cookbook/
export default defineConfig({
  base: "/macro-cookbook/",
  plugins: [react(), tailwindcss()],
});
