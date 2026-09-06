// @ts-check
import { defineConfig, envField } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";

// @astrojs/cloudflare's own configEnvironment hook pre-bundles most astro/* internals
// for the "astro"/"ssr"/"prerender" Vite environments but omits astro/env/runtime, so the first
// SSR request touching Astro's typed `env` schema triggers a mid-request optimizeDeps
// reload that tears down the in-flight React render (see cold-start test results).
function ssrEnvRuntimeOptimizeDeps() {
  return {
    name: "scene-forge:ssr-env-runtime-optimize-deps",
    configEnvironment(/** @type {string} */ name) {
      if (["astro", "ssr", "prerender"].includes(name)) {
        return { optimizeDeps: { include: ["astro/env/runtime"] } };
      }
    },
  };
}

// https://astro.build/config
export default defineConfig({
  output: "server",
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss(), ssrEnvRuntimeOptimizeDeps()],
    optimizeDeps: {
      include: ["@anthropic-ai/sdk"],
    },
  },
  adapter: cloudflare(),
  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: "server", access: "secret", optional: true }),
      SUPABASE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      ANTHROPIC_API_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      ANTHROPIC_WORKSPACE_ID: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
});
