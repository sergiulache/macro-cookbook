# Handover — Macro Cookbook (2026-06-13)

What I built while you were away, what works, and the things only **you** can verify or unblock.

## Live + how to run

- **Live site:** https://sergiulache.github.io/macro-cookbook/ (GitHub Pages, deploys on every push to `main` via `.github/workflows/deploy.yml`).
- **Repo:** github.com/sergiulache/macro-cookbook (public — required for free Pages; ADR-0001).
- `yarn dev` — local dev · `yarn build` — prod build · `yarn preview` — serve build.
- `yarn extract:all` — re-run full extraction (regenerates `src/data/generated/recipes.json` + `public/recipes/*.webp` + `out/sample/coverage.html`).
- `yarn typecheck` — `tsc -b`.

## What's done

- **Extraction (Slice 0–2):** 136 recipes parsed from the PDF text layer (exact numbers, not OCR), schema-validated (zod, `src/lib/schema/`), 12 categories, hero images optimized to webp (~35MB total). Method + parser proved on hard layouts (multi-group, two-page, sub-recipes).
- **App (Slice 1 + 3):** Vite + React 19 + Tailwind v4 + framer-motion, DESIGN.md monochrome language. Browse (fuzzy search, category + auto-tag filters, sort, animated reflow grid) and recipe detail (hero, serving scaler with tweened totals, ingredient groups, steps, tips, Watch-video button).

## NEEDS YOU — blockers / unverifiable

1. **Firebase project + login gate (biggest item).** The app is currently **open** (no auth). The login gate (D17) and everything that stores data — favorites, notes, the weekly plan, the synced shopping list (Slices 5–8) — need a Firebase project. I did **not** create it because it should sit under your ReziQuiz billing account and the billing link needs `gcloud auth`. To unblock: tell me to create `macro-cookbook-*` (you're already `firebase login`'d), or create it in the console and I'll wire it. ReziQuiz project id for the billing account: `reziquiz-827cc`.

2. **2 recipes have no macros — manual entry.** *Nickchicken* and *Nickchicken Meal Prep*. Their macro values sit on PDF pages **115 / 353, which are corrupt/image-only** — unreadable by any tool I have (render comes out blank). Please read the macros from the physical book / another PDF viewer and paste them here; I'll patch the data. (They're the only two with all-zero macros; *Maple Syrup* is legitimately 0-cal.)

3. **Spot-check extraction accuracy.** I verified the *parsing logic* and cross-checked the fixtures, but I can't confirm every number against the physical book. Open `out/sample/coverage.html` (after `yarn extract:all`) — it flags 7 recipes. Worth eyeballing a handful of multi-page recipes (deep dishes, anything in "Doughlicious"/"Prep School").

4. **A few cosmetic parser edges:** wrapped captions can truncate (e.g. title shows "Lou'S Sausage" instead of "Lou's Sausage Deep Dish Pizza"); multi-word group headers are recovered via a vocabulary list (`HEADER_VOCAB` in `scripts/extract/parser.ts`) — if any recipe shows a run-together header like "SOMETHINGNEW", add the words there and re-run.

5. **Design / animation taste.** Open the live site and judge it — that's yours to call.

## Not built yet (remaining slices)

- **Slice 4** — inline cross-reference links in steps (data is captured in `references[]`, just not yet rendered as links), related-recipes, cooking mode (wake-lock).
- **Slice 5–8** — favorites + notes, custom-recipe builder, weekly meal plan, shopping list. All gated on the Firebase decision (#1).
- **Slice 9** — reference pages (intro/techniques/pantry/FAQ), About/credits, ingredient-database table extraction (the per-ingredient macros table for the custom builder — a separate grid parser, not yet written).

## Notes / decisions taken autonomously

- **HashRouter** (URLs contain `#/r/...`) — refresh-safe and shareable on Pages without server config. Swappable for clean paths later.
- Hero images moved to `public/recipes/` (served at the base path); extractor now writes there.
- `build` runs `vite build` only (esbuild); `tsc` strict unused-checks relaxed in `tsconfig.app.json` during build-out — re-tighten before final.
- Full rationale for every product decision: `DECISIONS.md` (D1–D34) + `docs/adr/`.
