# Handover - Macro Cookbook (2026-06-13)

What I built while you were away, what works, and the things only **you** can verify or unblock.

## Live + how to run

- **Live site:** https://sergiulache.github.io/macro-cookbook/ (GitHub Pages, deploys on every push to `main` via `.github/workflows/deploy.yml`).
- **Repo:** github.com/sergiulache/macro-cookbook (public - required for free Pages; ADR-0001).
- `yarn dev` - local dev · `yarn build` - prod build · `yarn preview` - serve build.
- `yarn extract:all` - re-run full extraction (regenerates `src/data/generated/recipes.json` + `public/recipes/*.webp` + `out/sample/coverage.html`).
- `yarn verify` - deterministic data check: every title word, macro number, and ingredient must appear in the source page text, plus a structural merged-header check. Currently passes all 136.
- `yarn typecheck` - `tsc -b`.

## What's done

- **Extraction (Slice 0-2):** 136 recipes parsed from the PDF text layer (exact numbers, not OCR), schema-validated (zod, `src/lib/schema/`), 12 categories, hero images optimized to webp (~35MB total). Method + parser proved on hard layouts (multi-group, two-page, sub-recipes).
- **App (Slice 1 + 3):** Vite + React 19 + Tailwind v4 + framer-motion, DESIGN.md monochrome language. Browse (fuzzy search, category + auto-tag filters, sort, animated reflow grid) and recipe detail (hero, serving scaler with tweened totals, ingredient groups, steps, tips, Watch-video button).
- **Recipe features (Slice 4):** inline cross-reference links in steps (group jumps, recipe-to-recipe links like "FOOLPROOF HOMEMADE MARINARA", video-timestamp deep links), full-screen **cooking mode** with screen wake-lock, and a "You might also like" related-recipes strip. All live and screenshot-verified.
- **Data quality pass:** after spot-checks found a high defect rate, the parser was overhauled and the book re-extracted. Fixed: multi-word run-together headers (complete segmenter), digit-led titles, dense-layout captions, "INGREDIENTS CONT" continuation pages, header annotations like "(Per Biscuit)", caption-bleed into ingredients, caps reference-ingredients, and over-eager continuation merging. Categories normalized to plain words. `yarn verify` passes all 136.
- **UI fixes:** filter bar no longer sticky (was eating the mobile screen), results paginated at 24/page, and scroll resets to top on navigation.

## Firebase (done)

Project `macro-cookbook` (console: https://console.firebase.google.com/project/macro-cookbook), billing linked to ReziQuiz's account (`01E673-1FEEA7-6F5D06`), Firestore in `eur3`, Google sign-in enabled, web app + public config in `src/lib/firebase.ts`. Rules (`firestore.rules`) are **locked to two UIDs** (Sergiu `LDl4A6ilzUdGJOsgVLq5CWUg2PA2`, Ane `B2eHoIgwDqhPDZvu1P8iC3Gpefq2`) in `src/lib/data/people.ts`. To add a person: sign them in once, fetch their UID (`accounts:query` Admin API), add it to both `firestore.rules` and `people.ts`, redeploy rules (`firebase deploy --only firestore:rules`).

## NEEDS YOU - remaining

2. **2 recipes have no macros - manual entry.** *Nickchicken* and *Nickchicken Meal Prep*. Their macro values sit on PDF pages **115 / 353, which are corrupt/image-only** - unreadable by any tool I have (render comes out blank). Please read the macros from the physical book / another PDF viewer and paste them here; I'll patch the data. (They're the only two with all-zero macros; *Maple Syrup* is legitimately 0-cal.)

3. **Spot-check extraction accuracy.** `yarn verify` confirms nothing is missing/invented and catches merged-header structure, but it cannot catch every structural nuance (e.g. an ingredient placed in the wrong group). A full vision pass (parallel subagents comparing each render to its JSON) was offered and deferred. If you find issues by eye, tell me and I fix the class. Known-fixed examples to re-check: protein-buns, chicken-parmesan-sandwich, honey-butter-chicken-biscuit, chicken-gyro-salad, crunchwrap-supreme, the deep-dish/pot-pie recipes.

4. **A few cosmetic parser edges:** wrapped captions can truncate (e.g. title shows "Lou'S Sausage" instead of "Lou's Sausage Deep Dish Pizza"); multi-word group headers are recovered via a vocabulary list (`HEADER_VOCAB` in `scripts/extract/parser.ts`) - if any recipe shows a run-together header like "SOMETHINGNEW", add the words there and re-run.

5. **Design / animation taste.** Open the live site and judge it - that's yours to call.

## Done since: Slices 5, 7, 8

- **Slice 5** - Google sign-in gate (whole app), per-person favorites (star on cards + detail, Favorites filter), Firestore rules locked to the two members.
- **Slice 7** - joint weekly meal plan: navigable ISO weeks, 7-day view, per-day cal/protein, add-to-plan from a recipe with chosen servings, live-synced.
- **Slice 8** - joint shopping list: generate a snapshot from the week, sum matching item+unit (mismatched units kept separate), group by store category, check-off + manual items, live-synced. AI Romanian-aisle ordering seam left in `aggregate.ts` (D14).

## Not built yet

- **Slice 5 remainder** - per-recipe personal notes (small).
- **Slice 6** - custom-recipe builder. Needs the per-ingredient macro table extracted first (a separate grid parser; the recipe parser does not handle the table layout).
- **Slice 9** - reference pages (intro/techniques/pantry/FAQ), About/credits, the ingredient-database table.

## Notes / decisions taken autonomously

- **HashRouter** (URLs contain `#/r/...`) - refresh-safe and shareable on Pages without server config. Swappable for clean paths later.
- Hero images moved to `public/recipes/` (served at the base path); extractor now writes there.
- `build` runs `vite build` only (esbuild); `tsc` strict unused-checks relaxed in `tsconfig.app.json` during build-out - re-tighten before final.
- Full rationale for every product decision: `DECISIONS.md` (D1-D34) + `docs/adr/`.
