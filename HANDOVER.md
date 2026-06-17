# Handover - Macro Cookbook (2026-06-13)

What I built while you were away, what works, and the things only **you** can verify or unblock.

## Live + how to run

- **Live site:** https://sergiulache.github.io/macro-cookbook/ (GitHub Pages, deploys on every push to `main` via `.github/workflows/deploy.yml`).
- **Repo:** github.com/sergiulache/macro-cookbook (public - required for free Pages; ADR-0001).
- `yarn dev` - local dev · `yarn build` - prod build · `yarn preview` - serve build.
- `yarn extract:all` - re-run full extraction (regenerates `src/data/generated/recipes.json` + `public/recipes/*.webp` + `out/sample/coverage.html`).
- `yarn verify` - deterministic data check: every title word, macro number, and ingredient must appear in the source page text, plus a structural merged-header check. Currently passes all 136.
- `yarn extract:ingredients` - build the ingredient macro database from the reference tables (regenerates `src/data/generated/ingredients.json`, 244 entries).
- `yarn verify:ingredients` - deterministic check that every ingredient name and macro number appears verbatim on its source table page. Currently clean.
- `yarn extract:usda` - normalize the USDA SR Legacy dataset into `src/data/generated/usda-ingredients.json` (~7,450 foods). The raw dataset is external (not committed); download once: `curl -o /tmp/srl.zip https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip && unzip -o /tmp/srl.zip -d /tmp/srl`, then run with `USDA_DIR=/tmp/srl/FoodData_Central_sr_legacy_food_csv_2018-04`.
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

## Done since: Slice 6 (custom recipe builder)

- **Slice 6a - ingredient macro database.** New grid parser (`scripts/extract/ingredients.ts`) over the book's REFERENCE TABLES (pp.376-401): Meat+Seafood (per 85g cooked), Fruit + Vegetable (per 100g, with fiber), Seasonings+Dried (per 100g), and Control Macros (per-row serving, brand split). Reads only the alphabetical sort pages so rows are not double-counted. 244 entries to `src/data/generated/ingredients.json`, zod-validated, with a deterministic `yarn verify:ingredients`. Note: there is **no** separate "Protein Macros"/"Dairy Macros" table (those names in the old next-session notes were guesses); dairy lives in Control Macros.
- **Slice 6b - the builder.** `/build` (and `/build/:id` to edit): search the DB, add gram-quantity lines, macros compute live (value * grams / reference amount), set servings + optional directions, save to `users/{uid}/customRecipes/{id}` (Mutually-Viewable). A merged `RecipeIndex` context makes custom recipes behave like book recipes everywhere - browse search/filter/sort, detail + scaler, cooking mode, planner totals, shopping list - with no special-casing. Owner can edit/delete from the recipe page. Existing Firestore rules already cover the subcollection (no rules change).
- **Slice 6c - USDA external ingredients.** The book tables only cover whole foods + staples, so the builder also searches ~7,450 verified USDA SR Legacy foods (public domain, per 100g), lazy-loaded as its own chunk. Unified ranked search shows book results first then USDA, with a small USDA tag on external rows and a 'top N of M, keep typing to narrow' hint. Custom recipe lines snapshot the ingredient's per-amount + macros, so USDA-based recipes total correctly everywhere without loading the big set. (Considered Open Food Facts and the live USDA API; rejected for crowd-sourced noise and the fact that a USDA key in a public repo gets deactivated. Build-time normalization is the clean/fast fit.) **Needs the same live owner test as 6b.**

## Done since: AI layer (D14, recipe import)

The builder can **import a recipe with AI**. A Gemini proxy Cloud Function (`functions/index.js`, `aiGenerate`, gen2/europe-west1) holds the key server-side (it can't ship in the public bundle - Google auto-disables exposed keys), is gated to the two member UIDs, fetches a YouTube video's description server-side, and calls `gemini-3.1-flash-lite` with a `responseSchema`. The builder's `AiImportPanel` lets you stack multiple sources for one recipe (paste text in any language, a YouTube link, free-form notes/preferences), Generate, and the zod-validated result drops into the form for review/edit before saving (never blind-saved); imported lines carry an `AI` tag. The system prompt is **shared/joint and editable** (Firestore `joint/aiSettings`, strong default in `src/lib/ai/prompt.ts`) with an updated-at/by stamp and a 5-version rollback history; the store-section order is likewise joint with an updated-at stamp. Token usage stays per-person (`users/{uid}.aiTokens`). Token usage shows subtly; rate-limit/failure shows loudly. Tested end-to-end locally (YouTube description -> structured macros, honored notes); the final signed-in test is yours. First deploy needed Compute Engine API enabled + build-SA roles (recorded in project memory).

## Not built yet

- **Slice 9** - reference pages (intro/techniques/pantry/FAQ), About/credits. (The ingredient-database table is now extracted as data, Slice 6a; the Satiety Index p400 is the remaining reference-only table.)
- **Optional grouped sections** in custom recipes (D31 allows them; builder ships flat single-group lines for now).

## Notes / decisions taken autonomously

- **HashRouter** (URLs contain `#/r/...`) - refresh-safe and shareable on Pages without server config. Swappable for clean paths later.
- Hero images moved to `public/recipes/` (served at the base path); extractor now writes there.
- `build` runs `vite build` only (esbuild); `tsc` strict unused-checks relaxed in `tsconfig.app.json` during build-out - re-tighten before final.
- Full rationale for every product decision: `DECISIONS.md` (D1-D34) + `docs/adr/`.
