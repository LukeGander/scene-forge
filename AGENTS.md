# Repository Guidelines

SceneForge is an SSR web app that transforms loose scene notes into structured scene cards for solo point-and-click game creators. Stack: Astro v6, React v19, TypeScript v5, Tailwind CSS v4, Supabase (PostgreSQL + auth), deployed to Cloudflare Workers/Pages via `@astrojs/cloudflare`.

## Product Scope

- Use `@context/foundation/prd.md` as the source of truth for product scope, MVP boundaries, success criteria, and non-goals before adding or changing features.
- Do not expand beyond the MVP or reintroduce non-goals without explicit approval.
- In the MVP, generated scene cards are mostly read-only: users edit status, title, and a freeform notes/corrections field, not every generated card field.
- Characters are optional context for Forge Scene. Character/NPC function is required only when characters are present in the scene.

## Hard Rules

- **Never expose `SUPABASE_URL` or `SUPABASE_KEY` to the client.** Both are declared server-only in `astro.config.mjs`. Use them only in `.astro` frontmatter, API routes, or server-side lib functions — never in React components.
- Route protection is centralized in `src/middleware.ts` via the `PROTECTED_ROUTES` array. Add new protected routes there, not in individual page files.
- `astro/no-set-html-directive` is enforced at error level. Never use `set:html` with user-supplied content.

## Project Structure

Source lives under `src/`: `components/` (React + Astro UI), `pages/` (routes — includes `api/` and `auth/` subdirs), `layouts/` (shared page wrappers), `lib/` (utilities), `styles/` (global CSS), `middleware.ts` (route guard), `env.d.ts` (env types). Static assets in `public/`. Planning artifacts in `context/`.

Path alias `@/*` resolves to `./src/*` — use it in all cross-directory imports.

## Build, Test, and Development Commands

See `@README.md` for the full script list. Two project-specific notes: `npm run build` requires `SUPABASE_URL` and `SUPABASE_KEY` to be set in the environment. No test framework is configured — the CI gate (`.github/workflows/ci.yml`) runs `astro sync` → lint → build only.

## Coding Style & Naming Conventions

- TypeScript strict mode via `astro/tsconfigs/strict`; see `@tsconfig.json`.
- Prettier config: see `@.prettierrc.json`.
- ESLint enforces `typescript-eslint` strictTypeChecked + stylisticTypeChecked. `no-console` is a warning — strip `console.log` before committing.
- React Compiler plugin is enforced at error level (`react-compiler/react-compiler: error`); do not disable the compiler on individual components.

## Commit & Pull Request Guidelines

Imperative present tense, capitalized, no trailing period: `Add dashboard route`, `Fix middleware redirect`, `Update Supabase client`. CI gate triggers on pushes and PRs to `master`; run `npm run lint` and `npm run build` locally before pushing.
