# Macro Cookbook — Implementation Plan (Vertical Slices)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the 401-page *Diet Cheat Codes* PDF into a fast, login-gated, two-person web cookbook with search/filter/scaling, a custom-recipe builder, a joint weekly meal plan, and a synced shopping list — built and deployed end-to-end.

**Architecture:** Static Vite/React/TS SPA (recipe content bundled as JSON + optimized images) deployed to GitHub Pages; Firebase (Google Auth + Firestore) as the only backend, gating the whole app and storing synced personal/joint data. A single zod schema is the contract shared by the extraction pipeline and the app. See `DECISIONS.md` (D1–D34) and `docs/adr/` for the *why* behind every choice.

**Tech Stack:** Vite, React, TypeScript, Tailwind (DESIGN.md tokens), shadcn/ui (Radix primitives restyled to the tokens), framer-motion, zod, Fuse.js (fuzzy search), Firebase JS SDK, **yarn**, vitest. Extraction: a TS script run with yarn + Poppler (`pdftoppm`, `pdfimages`, `pdftotext`), `sharp` (image optimization), `jsqr` (QR decode off the page render).

**Scaffolding conventions:** use native CLIs — `npm create vite@latest`, `npx shadcn@latest init`/`add`, etc. — and only hand-edit the generated files afterward. Never write a vite/tailwind/tsconfig from scratch if a generator produces it. Installs use **yarn**.

---

## Method: how vertical slices work here

Each slice cuts top-to-bottom through **one capability** — the minimum data/rules + UI + tests + docs to prove it works and is deployed — rather than building a whole layer at once. Every slice after Slice 1 ends with something openable in the browser. Earlier slices stand up the thin infra later slices reuse (auth shell, routing, design tokens, the two Firestore data patterns), but only as much as the current feature needs.

**Extraction is de-risked before it is scaled.** Slice 0 proves the extraction method on a tiny representative sample and shows you the output for sign-off. Only Slice 2 runs it on all ~150 recipes.

**Commit cadence:** commit after every green step (TDD modules) or every coherent task (UI). Each slice is at least one logical branch merged to `main`; `main` always deploys.

---

## File Structure

```
macro-cookbook/
├── DECISIONS.md                      # decision log (exists)
├── docs/adr/                         # ADRs 0001-0003 (exist)
├── docs/superpowers/plans/           # this plan
├── README.md                         # minimal docs (Slice 9)
├── package.json  vite.config.ts  tsconfig.json
├── tailwind.config.ts  postcss.config.js
├── index.html
├── .github/workflows/deploy.yml      # GitHub Pages CI (Slice 1)
├── firebase.json  .firebaserc  firestore.rules  firestore.indexes.json
├── scripts/extract/                  # extraction pipeline (bun)
│   ├── extract.ts                    # PDF → typed JSON
│   ├── images.ts                     # sharp optimization → AVIF/WebP responsive
│   ├── qr.ts                         # decode QR → youtube URL
│   ├── report.ts                     # coverage/diff report vs page renders
│   └── sample.config.ts              # the Slice-0 sample page set
├── src/
│   ├── main.tsx  App.tsx  router.tsx
│   ├── lib/
│   │   ├── schema/                   # zod contracts — SHARED with scripts/extract
│   │   │   ├── recipe.ts  ingredient.ts  subrecipe.ts  userdata.ts
│   │   ├── design/tokens.ts          # DESIGN.md tokens → Tailwind preset
│   │   ├── firebase.ts               # SDK init
│   │   ├── auth/                     # AuthContext, useAuth, AuthGate
│   │   ├── data/                     # firestore hooks (favorites, notes, plan, list)
│   │   ├── recipes/                  # loadRecipes, search.ts, filter.ts, sort.ts, tags.ts, related.ts
│   │   ├── scaler.ts                 # serving scaler math
│   │   ├── references.ts             # in-step / recipe→recipe / video-timestamp resolver
│   │   └── shopping/aggregate.ts     # item+unit summing, categorization
│   ├── components/
│   │   ├── motion/                   # FadeIn, AnimatedNumber, ReflowList, SharedLayout
│   │   └── ui/                       # Pill, Card, SearchPill, NavDrawer, MacroBadge, ...
│   ├── features/
│   │   ├── browse/ recipe/ favorites/ notes/ builder/ plan/ shopping/ reference/ auth/
│   ├── data/generated/               # recipes.json, ingredients.json, subrecipes.json (git-committed)
│   └── assets/recipes/               # optimized images (git-committed)
└── test/                             # vitest; pure-logic unit tests + rules tests
```

**Key invariant:** `src/lib/schema/*` is imported by both the extraction script and the app. The JSON in `src/data/generated/` must pass these schemas at build time (D33).

---

## Slice 0 — Extraction proof-of-concept (SPIKE, gated by your review)

**Proves:** the extraction method produces correct, typed, lossless data + optimized images from real pages — *before* we commit to all 150. Output is a review artifact, not app UI.

**Infra stood up:** repo init, bun project, Poppler/sharp/jsqr toolchain, the zod schema (first draft), extraction script structure.

**Sample (representative of every hard case):** pick ~6 items at execution by scanning the TOC + pages:
- one simple single-page recipe (e.g. *Banana Pancakes* — Wet/Dry Ingredient groups),
- one two-page-instructions recipe (macros on page 2 — e.g. a deep-dish pizza),
- one recipe referencing a sub-recipe by name (*Dominos Cheesy Bread* → "FOOLPROOF HOMEMADE MARINARA"),
- one recipe with a `TIP:` block and a video-timestamp reference,
- one shared sub-procedure / illustrated process spread (e.g. *Deep dish Process*),
- a ~20-row slice of the per-ingredient macro TABLE.

**Tasks:**

- [ ] **0.1** `git init`, `yarn init -y`, `yarn add zod sharp jsqr tsx`, ensure `pdftoppm/pdfimages/pdftotext` present. Commit.
- [ ] **0.2** Write `src/lib/schema/recipe.ts`, `ingredient.ts`, `subrecipe.ts` (the v1 contract — see schema below). Commit.
- [ ] **0.3** `scripts/extract/images.ts`: render a page to PNG (`pdftoppm`), extract embedded photo (`pdfimages`), output responsive AVIF+WebP at 400/800/1200px via `sharp`, return `{src, srcset, width, height, blurDataURL}`. 
- [ ] **0.4** `scripts/extract/qr.ts`: locate + decode the QR on the page render with `jsqr`, return the YouTube URL (or null).
- [ ] **0.5** `scripts/extract/extract.ts`: for each sample page, produce a `Recipe` object conforming to the schema by reading the rendered page (visual extraction; text layer is unreliable per D6). Stitch two-page recipes. Capture prepTime/cookTime/tips conditionally (D5).
- [ ] **0.6** `scripts/extract/report.ts`: emit `out/sample/report.html` showing, per recipe, the **page render side-by-side with the extracted JSON**, plus a zod-validation pass/fail badge and a list of any low-confidence fields (D-verification: flag the shaky ones).
- [ ] **0.7** Run on the sample. Open the report.
- [ ] **0.8 — REVIEW GATE (you):** eyeball the report. Confirm the schema captures everything, nothing is lost, the method is sound. Adjust schema/method and re-run until you sign off. **No further slice starts until this passes.**

**The v1 schema (`src/lib/schema/recipe.ts`):**
```ts
import { z } from "zod";
export const Macros = z.object({
  calories: z.number(), fat: z.number(), carbs: z.number(),
  netCarbs: z.number().nullable(), protein: z.number(),
});
export const Ingredient = z.object({
  amount: z.number().nullable(),      // null when "to taste"
  unit: z.string().nullable(),        // "g", "tbsp", null
  item: z.string().min(1),
  note: z.string().optional(),        // "(optional)", brand hints
});
export const IngredientGroup = z.object({
  name: z.string().min(1),            // "DOUGH", "Wet Ingredients" — referenced in steps
  ingredients: z.array(Ingredient).min(1),
});
export const Step = z.object({ n: z.number(), text: z.string().min(1) });
export const Recipe = z.object({
  id: z.string(),                     // slug, e.g. "dominos-cheesy-bread"
  title: z.string().min(1),
  category: z.string().min(1),        // "Breakfast Bliss", ...
  servings: z.number().positive(),
  macros: Macros,                     // per serving
  ingredientGroups: z.array(IngredientGroup).min(1),
  steps: z.array(Step).min(1),
  image: z.object({ src: z.string(), srcset: z.string(), width: z.number(), height: z.number(), blurDataURL: z.string() }).nullable(),
  videoUrl: z.string().url().nullable(),
  prepTimeMin: z.number().nullable(),
  cookTimeMin: z.number().nullable(),
  tips: z.array(z.string()).default([]),   // empty → not rendered (D5)
  references: z.array(z.object({           // resolved at extraction where possible (D21-D23)
    raw: z.string(), kind: z.enum(["group","recipe","video-timestamp"]),
    target: z.string().nullable(), seconds: z.number().nullable(),
  })).default([]),
  sourcePages: z.array(z.number()),        // provenance for verification
});
export type Recipe = z.infer<typeof Recipe>;
```

---

## Slice 1 — Walking skeleton: deploy + auth gate + one recipe rendered

**Proves:** the full pipeline is real — build → GitHub Pages deploy → open URL → Google sign-in → see ONE real recipe rendered in the DESIGN.md language, loaded from bundled JSON and schema-validated.

**Infra stood up (reused by every later slice):** Vite/React/TS app, Tailwind preset from DESIGN.md tokens, client routing, Firebase init, Google auth context + whole-app `AuthGate` (D17), CI deploy, motion primitives skeleton.

**Backend cut:** Firebase project + Google auth provider only (no Firestore data yet). 
**Frontend cut:** app shell, login screen, one recipe detail route. 
**Tests:** zod validates the (sample) bundled recipe; unit test for the slug util. 
**Docs:** README "run/deploy" stub.

**Tasks:**

- [ ] **1.1** Scaffold with native CLIs: `npm create vite@latest . -- --template react-ts`, `yarn`, add Tailwind, then `npx shadcn@latest init`. Hand-edit the generated `tailwind.config.ts` to consume `src/lib/design/tokens.ts` (colors/typography/rounded/spacing from DESIGN.md); add fonts (Nunito for SF-Pro-Rounded substitute, Inter for body, JetBrains Mono — per DESIGN.md "Font Substitutes"); set `vite.config.ts` `base: "/macro-cookbook/"`. shadcn primitives (dialog, slider, dropdown, drawer) added per-slice via `npx shadcn@latest add` and restyled to the tokens. Commit.
- [ ] **1.2** Firebase: `firebase projects:create macro-cookbook-<suffix>`, link ReziQuiz's billing account (`gcloud billing projects link` using the account on `reziquiz-827cc`), enable Google auth provider, add web app, write `src/lib/firebase.ts` + `.firebaserc` + `firebase.json` (Firestore only; hosting stays GitHub Pages). Public Firebase web config is committed (it's not a secret). Commit.
- [ ] **1.3** `src/lib/auth/`: `AuthContext` (onAuthStateChanged), `useAuth()`, `AuthGate` wrapping the app — unauthenticated → login screen with a single black-pill "Sign in with Google" (DESIGN.md `button-primary`). Commit.
- [ ] **1.4** `src/router.tsx`: routes `/` (browse stub), `/r/:id` (recipe detail), with a `NavDrawer` (DESIGN.md hamburger drawer). Per-recipe URLs (D26). Commit.
- [ ] **1.5** Copy the Slice-0 sample JSON+images into `src/data/generated/` + `src/assets/recipes/`. `src/lib/recipes/loadRecipes.ts` imports + `z.array(Recipe).parse()` at module load (build-time gate, D33).
- [ ] **1.6 (TDD)** `src/lib/recipes/slug.ts` `slugify(title)`; test: `slugify("Domino's Cheesy Bread") === "dominos-cheesy-bread"`. Red → green → commit.
- [ ] **1.7** Recipe detail page: hero image (blur-up), title (`display-xl`), macro badges, ingredient groups, numbered steps, "Watch video" pill (D3). Strict monochrome (D20). Commit.
- [ ] **1.8** `.github/workflows/deploy.yml`: on push to `main`, `yarn install --frozen-lockfile`, `yarn build` (fails if schema parse throws), deploy `dist/` to Pages. Enable Pages (source = Actions) via `gh`.
- [ ] **1.9** Create public repo `sergiulache/macro-cookbook`, push, confirm deploy, open the URL, sign in, view the recipe. **Checkpoint.** README run/deploy stub. Commit.

---

## Slice 2 — Full extraction & validation

**Proves:** all ~150 recipes + the full ingredient database + sub-procedures are extracted, schema-valid, and verified.

**Tasks:**

- [ ] **2.1** Build the category list from the TOC; map every recipe page range. Commit the manifest.
- [ ] **2.2** Run the (Slice-0-proven) pipeline over all recipes → `recipes.json`; extract the full macro table → `ingredients.json` (schema `ingredient.ts`); extract shared sub-procedures → `subrecipes.json` (D24). Optimize all images.
- [ ] **2.3** Resolve references (D21-D23): for each capitalized in-step token, match a local group → else a recipe/subrecipe title → else leave plain. Populate `references[]`.
- [ ] **2.4** Run the full coverage report (`report.ts`): counts, every recipe render-vs-JSON, flagged low-confidence list.
- [ ] **2.5 — REVIEW GATE (you):** spot-check the flagged recipes against the PDF (D-verification). Fix + re-run until clean.
- [ ] **2.6** Drop artifact-only pages (D27); confirm About/credits content captured. Commit all generated data.

---

## Slice 3 — Browse: search / filter / sort / tags + signature motion

**Proves:** the core "better than a PDF" experience — find any recipe instantly, with the card→detail shared-element transition and animated reflow (D34).

**Backend cut:** none (static data). **Frontend cut:** browse grid + controls. **Tests:** search/filter/sort/tags pure functions. **Docs:** none.

- [ ] **3.1 (TDD)** `src/lib/recipes/tags.ts` `deriveTags(recipe)` → macro-based + time-based + meal-type cross-tags (D7). Tests: high-protein ≥30g protein; quick if prep+cook <30; dessert if category∈sweets. Red→green→commit.
- [ ] **3.2 (TDD)** `filter.ts` `applyFilters(recipes, {categories, macroRanges, tags})`; tests cover macro range bounds + multi-tag AND. Commit.
- [ ] **3.3 (TDD)** `sort.ts` `sortRecipes(recipes, key, dir)` for each macro/time/title; tests. Commit.
- [ ] **3.4** `search.ts` wraps Fuse.js over title+ingredients+tips; manual smoke + one test that a typo still matches. Commit.
- [ ] **3.5** `components/motion/`: `FadeIn`, `ReflowList` (framer-motion `layout`), `SharedLayout`/`AnimatedNumber` (spring config from a single `motion/config.ts`, D34). Commit.
- [ ] **3.6** Browse page: `SearchPill`, category pills, macro-range sliders, sort menu, recipe cards in a `ReflowList`; results reflow on filter. Commit.
- [ ] **3.7** Shared-element card→detail transition (framer-motion `layoutId` on photo+title). **Checkpoint:** verify smoothness in browser. Commit.

---

## Slice 4 — Recipe-detail power features: scaler, cooking mode, cross-links, related

**Proves:** everything you'd do on a single recipe beyond reading it.

**Tests:** scaler math, reference resolver rendering, related-recipes ranking. **Frontend:** detail-page enhancements + cooking mode route.

- [ ] **4.1 (TDD)** `scaler.ts` `scale(recipe, targetServings)` → scaled ingredient amounts + scaled macros; tests: 2→4 doubles amounts+macros; null-amount ("to taste") stays null; rounding rule fixed. Red→green→commit.
- [ ] **4.2** Serving stepper on detail page; quantities + macros use `AnimatedNumber` tweening (D34). Commit.
- [ ] **4.3 (TDD)** `references.ts` `renderStep(step, recipe, index)` → segments with link targets (group anchor / recipe route / `youtube?t=Ns`); tests for each kind + the "matches nothing → plain text" case (D21-D23). Commit.
- [ ] **4.4** Wire step links: in-step→scroll/highlight group; recipe→route jump; video-timestamp→deep link. Commit.
- [ ] **4.5 (TDD)** `related.ts` `relatedTo(recipe, all)` → rank by shared category + shared key ingredients + macro proximity; test ordering on a fixture. Commit (D25).
- [ ] **4.6** "Related recipes" strip on detail page. Commit.
- [ ] **4.7** Cooking mode route `/r/:id/cook`: large step-by-step, `navigator.wakeLock` held while active, released on exit (D10). **Checkpoint** on a phone. Commit.

---

## Slice 5 — Favorites + personal notes (first Firestore user data)

**Proves:** the per-person, Mutually-Viewable Firestore pattern + rules + your gf's account registered (D15, D32).

**Backend cut:** Firestore `users/{uid}/favorites`, `users/{uid}/notes/{recipeId}`; rules allow read by either known UID, write only by owner. **Tests:** rules via emulator; data-hook unit test. **Docs:** note the two UIDs + how to add a person.

- [ ] **5.1** **You sign in once on the deployed app**; capture both UIDs. Put the two UIDs in `firestore.rules` (allowlist) + a `src/lib/data/people.ts` map. Commit.
- [ ] **5.2** `firestore.rules`: `users/{uid}/**` readable if `request.auth.uid in [UID_A, UID_B]`, writable only if `request.auth.uid == uid`. Deploy rules.
- [ ] **5.3 (TDD, emulator)** rules test: owner can write own favorite; partner can read it; stranger denied. `firebase emulators:exec "vitest run test/rules"`. Commit.
- [ ] **5.4** `src/lib/data/useFavorites.ts`, `useNotes.ts` (live `onSnapshot`). Star control on cards + detail; per-recipe notes editor (your notes editable, partner's read-only) (D32). Commit.
- [ ] **5.5** Favorites view (yours / partner's, not merged — D15). **Checkpoint:** sign in as each, confirm isolation + cross-visibility. Commit.

---

## Slice 6 — Custom recipe builder

**Proves:** the ingredient database powers user-authored recipes that behave like book recipes everywhere (D8, D31).

**Backend cut:** `users/{uid}/customRecipes/{id}` (Mutually-Viewable). **Tests:** macro computation from ingredient lines. **Frontend:** builder form + custom recipes in browse.

- [ ] **6.1 (TDD)** `src/lib/builder/computeMacros.ts` `(lines, ingredientsDB) → Macros`; tests: known ingredient×amount sums to expected macros; unknown ingredient flagged. Red→green→commit.
- [ ] **6.2** Builder UI: search the ingredient DB, add lines w/ amount+unit, set servings, optional groups + steps, live macro readout (`AnimatedNumber`); save to Firestore. Commit.
- [ ] **6.3** Custom recipes load into the same browse/detail/scaler pipeline (tagged "custom", per-person, mutually viewable). **Checkpoint.** Commit.

---

## Slice 7 — Weekly meal plan (Joint)

**Proves:** the Joint shared-data pattern + navigable date-keyed weeks (D11, D12, D29).

**Backend cut:** `joint/plan/weeks/{isoWeek}` (single shared doc, both UIDs read+write). **Tests:** week keying + plan ops. **Frontend:** week view + add-to-plan.

- [ ] **7.1 (TDD)** `src/lib/plan/week.ts` `isoWeekKey(date)` + `addToDay/removeFromDay/setServings`; tests incl. year boundary. Commit.
- [ ] **7.2** `firestore.rules`: `joint/**` read+write if uid ∈ allowlist. Deploy + emulator test (both can write, stranger denied). Commit.
- [ ] **7.3** `useWeekPlan(weekKey)` live doc. Week view (7 days, freeform list per day — D11), prev/next week nav, per-entry serving count, per-day macro total (informational, not a goal — D11/§10). "Add to plan" action on recipes. **Checkpoint:** edit on one client, see it on another. Commit.

---

## Slice 8 — Shopping list (Joint snapshot from the plan)

**Proves:** the plan→list generation with safe aggregation, the store workflow (D13, D30).

**Backend cut:** `joint/shoppingList` (single shared doc). **Tests:** aggregation. **Frontend:** generate/snapshot + checklist.

- [ ] **8.1 (TDD)** `src/lib/shopping/aggregate.ts` `aggregate(planEntries) → CategorizedList`; tests: `200g chicken + 100g chicken → 300g`; `1 onion + 150g onion → two lines` (no conversion); items grouped by category; servings scale quantities (D13). Red→green→commit.
- [ ] **8.2 (TDD)** `categorize(item) → category` (produce/dairy/meat/pantry/frozen/bakery/other) via keyword map; leave a documented seam for the future Romanian-aisle ordering (D14). Tests on representative items. Commit.
- [ ] **8.3** Shopping view: "Generate from week" (snapshot, with replace/merge prompt on regen — D30), category sections, check-off (persisted), add manual item; live-synced (`onSnapshot`). **Checkpoint:** generate, check items on two phones simultaneously. Commit.

---

## Slice 9 — Reference pages, About/credits, final polish

**Proves:** lossless content transfer is complete and the product is finished.

- [ ] **9.1** Reference pages from extracted prose: Intro, Cooking Techniques, Pantry Essentials, Kitchen Gear, FAQ, Informative Illustrations (D1). Route + drawer links. Commit.
- [ ] **9.2** Sub-procedures (`subrecipes.json`) as their own linkable entries that recipe links resolve to (D24). Commit.
- [ ] **9.3** Ingredient database reference page (searchable/sortable table — D2). Commit.
- [ ] **9.4** About page: credit Nick Kenney, photographer, the book, link to exercise4cheatmeals.com (D27/copyright posture). Commit.
- [ ] **9.5** Polish pass: route transitions + micro-interactions (D34), empty states, loading skeletons, focus rings (DESIGN.md), mobile drawer + responsive breakpoints. Commit.
- [ ] **9.6** README + minimal docs: run, build, deploy, re-run extraction, add a person. Final deploy. **Checkpoint.**

---

## Self-Review (spec coverage D1–D34)

- Content/scope D1✓(S9) D2✓(S2/S9) D3✓(S1) D27✓(S2/S9.4) — Data model D4✓(S0) D5✓(S0) D6✓(S0/S2)
- Features D7✓(S3) D8✓(S6) D9✓(S4.1) D10✓(S4.7) — Cross-refs D21-D25✓(S4/S9.2)
- Planning/shopping D11/D12✓(S7) D13✓(S8) D14✓(S8.2 seam) D29✓(S7.1) D30✓(S8.3)
- Sharing D15✓(S5/S7) D32✓(S5.4) — Auth/privacy D17✓(S1.3/S5.2) D18✓(S1.8 public Pages)
- Tech D19✓(S1) D26✓(S1.4) D28✓(online-only; no offline code added) D33✓(schema gate S0/S1.5 + unit tests throughout) — Design D20✓(S1.7) D34✓(S3.5/S4/S9.5)

**Open items resolved at execution (no decision needed):** exact category list (S2.1), recipe slugs (S1.6), two-page stitching (S0.5), gf UID registration (S5.1), billing-account link (S1.2).
