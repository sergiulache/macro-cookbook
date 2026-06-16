# Next-session handover - Macro Cookbook

For a fresh Claude Code session picking this up. Read this, then `DECISIONS.md` (D1-D34) and `docs/adr/` for the *why* behind every choice. `HANDOVER.md` is the human-facing status.

## Two hard rules (the owner is emphatic)

1. **Never use em-dashes** anywhere - not in prose, commits, PRs, or code comments. Use commas/periods/parentheses.
2. **Never add "Claude Code", "Generated with", or "Co-Authored-By" trailers** to commits or PRs. Plain commit messages only.

## What this is

A private, two-person web app rebuilding the *Diet Cheat Codes* recipe ebook (Nick Kenney). Live: **https://sergiulache.github.io/macro-cookbook/** · repo: **github.com/sergiulache/macro-cookbook** (public). 136 recipes extracted from the PDF, browse/search/filter, recipe detail with scaling + cross-links + cooking mode, favorites, joint weekly plan, synced shopping list. Login-gated (Google), Firestore for synced data.

## Stack & conventions

- **Vite + React 19 + TypeScript + Tailwind v4 + framer-motion + zod**, package manager **yarn**, Firebase (Auth + Firestore). Scaffolds via official CLIs; read official docs for install commands; don't hand-write generated config.
- **Design:** strict monochrome (DESIGN.md / Ollama language), food photos are the only color, light mode only. Tokens live in `src/index.css` `@theme`. Fonts: Nunito (display), Inter (body), JetBrains Mono.
- **Routing:** HashRouter (URLs have `#`), refresh-safe on Pages. Scroll resets on route change.
- **Build:** `yarn build` (vite, esbuild - no full typecheck); `yarn typecheck` runs `tsc -b`. Note `tsconfig.app.json` has `noUnusedLocals/Parameters` relaxed during build-out - re-tighten before calling it final.
- **Deploy:** push to `main` → GitHub Actions (`.github/workflows/deploy.yml`) → Pages (~1 min). Verify with Playwright by screenshotting the live URL.
- Commit per coherent chunk, frequently.

## File map

```
src/
  data/generated/recipes.json     # 136 recipes (the extracted data)
  lib/
    schema/{recipe,ingredient,subrecipe}.ts   # zod, shared with the extractor
    firebase.ts                    # public config (project macro-cookbook)
    auth/auth.tsx                  # AuthProvider, useAuth, Google sign-in
    data/{useFavorites,useRecipeNotes,useWeekPlan,useShoppingList,people}.ts
    recipes/{loadRecipes,tags,search?,related,references.tsx}
    scaler? (in RecipePage)  shopping/aggregate.ts
  components/{AuthGate,RecipeCard,FavoriteButton,AnimatedNumber}.tsx
  features/{browse,recipe,plan,shopping}/...
public/recipes/*.webp              # optimized hero images (committed)
scripts/extract/                   # the extraction pipeline (run with tsx)
```

## Extraction pipeline (how the data was made)

The PDF is at `/home/sergiu/Documents/Text/retete/Diet Cheat Codes Recipe Book ...pdf` (path in `scripts/extract/config.ts`, never committed). Source of truth is the **text layer via pdfjs** (exact numbers; NEVER read digits visually - that caused early errors). `scripts/extract/parser.ts` is geometry-driven (columns, captions, footers). Commands:
- `yarn extract:scan` - classify every page → `out/sample/scan.json`.
- `yarn extract:all` - full extraction → `recipes.json` + `public/recipes/*.webp` + `out/sample/coverage.html`. After re-extracting, prune orphan images (titles → ids change): a node snippet in git history under "prune orphan images".
- `yarn verify` - deterministic check: every title word, macro number, ingredient must appear in source; plus a structural merged-header check. **Currently passes all 136.** Run after any parser change.
- `yarn extract:report` / `find.ts` (locate pages) / `pdf.ts <page>` (dump items).

**Known data gaps / gotchas:**
- Corrupt PDF pages (blank, no text): **115, 118, 209, 319, 353**. Two recipes (`nickchicken`, `nickchicken-meal-prep`) have macros on 115/353 → all-zero macros, need manual entry (owner to provide; patch `recipes.json` or add an overrides map in `extract-all.ts`).
- `verify` checks presence, not full structure. Shopping-list dedup is intentionally conservative (exact item+unit). The owner will add a cheap LLM for dedup + Romanian-aisle ordering; the seam is `aggregate.ts`'s structured output (D14).

## Firebase (already set up)

Project `macro-cookbook` (console: https://console.firebase.google.com/project/macro-cookbook). Billing → ReziQuiz account `01E673-1FEEA7-6F5D06`. Firestore `eur3`. Google sign-in enabled. `firestore.rules` locked to two UIDs (in `src/lib/data/people.ts`): Sergiu `LDl4A6ilzUdGJOsgVLq5CWUg2PA2`, Ane `B2eHoIgwDqhPDZvu1P8iC3Gpefq2`. Data model: per-person `users/{uid}` (favorites array, notes map) - read by either, write owner-only; joint `joint/week_{ISO}` (plan) and `joint/shoppingList` - both read+write.
- firebase CLI is logged in as **sergiu272001@gmail.com**; gcloud as **sergiu.batrinac@casus.ch** + sergiu272001. Identity Toolkit Admin API calls need `-H "x-goog-user-project: macro-cookbook"` plus `gcloud auth print-access-token`.
- Deploy rules: `firebase deploy --only firestore:rules --project=macro-cookbook`.

## What's DONE

Slices 0-8: extraction (+ overhauled parser, normalized categories, verifier), app skeleton + Pages CI, browse (search/filter/sort/reflow), recipe detail (scaler, cross-ref links, cooking mode, related), Google auth gate, per-person favorites + notes, joint weekly plan, synced categorized shopping list.

**Slice 6 - custom recipe builder (DONE, needs live owner test).**
- 6a: ingredient macro DB from the back-of-book REFERENCE TABLES (pp.376-401) -> `src/data/generated/ingredients.json` (244 entries), built by `yarn extract:ingredients`, checked by `yarn verify:ingredients`. The real tables are Meat+Seafood (per 85g cooked), Fruit + Vegetable (per 100g, fiber column), Seasonings+Dried (per 100g), and Control Macros (per-row serving, brand in parens). There is NO "Protein Macros"/"Dairy Macros" table - those were wrong guesses; dairy is inside Control Macros. Each table repeats in several sort orders; only the alphabetical pages are read so rows are not double-counted. netCarbs is derived from fiber for fruit/veg, null elsewhere (owner does not rely on net carbs; calories + protein are the must-haves).
- 6b: builder at `/build` (+`/build/:id`). Search DB, add gram lines, live macro compute (value * grams / reference amount), servings + optional directions, save to `users/{uid}/customRecipes/{id}` (Mutually-Viewable). A merged `RecipeIndex` context makes custom recipes work in browse/detail/scaler/cooking-mode/planner/shopping with no special-casing. Existing Firestore rules already cover the subcollection.
- 6c: external ingredients via USDA FoodData Central. Built `yarn extract:usda` -> `src/data/generated/usda-ingredients.json` (~7,450 SR Legacy foods, public domain, per 100g, lazy-loaded chunk). The builder searches book + USDA with a unified ranked, grouped, capped result list (`src/lib/recipes/ingredientSearch.ts`), USDA rows tagged. Custom lines now snapshot per-amount + macros so they total correctly everywhere without loading the USDA set. Rejected Open Food Facts (noisy, weak text search) and live USDA API (public-repo key gets deactivated; CORS aside). To refresh/expand USDA later: optionally add Foundation Foods, or regenerate from a newer bulk download.
- The Master Recipe Nutrition Table (pp.377-381, per-serving + entire-batch) was found but NOT consumed; it is a clean deterministic cross-check that could verify all 136 recipe macros if absolute certainty is wanted.
- Stable checkpoint before 6c = git tag `checkpoint-slice6`. A manual 'type your own ingredient + macros' fallback was discussed but not built (USDA covers the long tail well enough for now).

## What's LEFT (in suggested order)

1. **Slice 9 - reference pages + About.** Extract the non-recipe prose pages (intro, "why my recipes work", pantry essentials, kitchen gear, cooking techniques, FAQ, illustrated guides) into static pages reachable from the nav (D1). Add an About/credits page: Nick Kenney, photographer Andrew Forest, exercise4cheatmeals.com. DROP artifact-only pages (dedication, copyright, the page-breakdown explainer) per D27.
2. **Patch the 2 Nickchicken macros** once the owner provides them.
3. **Polish:** re-tighten `tsconfig.app.json` unused checks; consider code-splitting (bundle now ~1.3MB, mostly recipes.json + ingredients.json); optional grouped sections in the custom builder (D31 allows them, ships flat for now); optional dark mode is explicitly out (D20).
4. **Optional:** full vision-subagent verification of all 136 recipes (the Master Recipe Nutrition Table on pp.377-381 is a cheap deterministic alternative to a vision pass) (owner declined "for now"; offer if absolute structural certainty is wanted). The owner also dislikes the AskUserQuestion picker being overused and ASCII previews - ask in plain prose unless a structured choice genuinely helps (see their feedback memories).

## Test loop for anything auth-gated

You can't complete Google sign-in as the agent. Build + deploy, then ask the owner to test on the live site (sign in, star, plan, generate shopping list, check sync between two devices). For data correctness, use `yarn verify` and Playwright screenshots of the live site.
