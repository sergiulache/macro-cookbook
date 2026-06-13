# Macro Cookbook — Decision Log

A private, two-person web app that replaces reading the *Diet Cheat Codes* recipe ebook (Nick Kenney, 2023; 401 pages). It must carry over **all** of the book's information losslessly — every recipe, every image, and the non-recipe prose — and then do what a PDF can't: search, filter, sort, scale servings, build custom recipes, plan a week of meals, and produce a shopping list synced to both phones.

This document records what we decided and **why**. The three weightiest, hardest-to-reverse choices also have their own ADRs in `docs/adr/`; this log is the complete picture and links to them where relevant.

---

## 1. Content & scope

**D1 — The app carries the whole book, not just recipes.**
The book has substantial non-recipe content: an intro, "why my recipes work," pantry essentials, kitchen gear, cooking techniques, illustrated guides, and an FAQ. The requirement is lossless transfer, so all of it stays.
*How:* recipes are the primary thing you browse/search; the prose content becomes a small set of read-only **reference pages** reached from the menu, so it's preserved without cluttering the recipe browser.

**D2 — The book's per-ingredient macro table becomes a real ingredient database.**
The book includes the reference table Nick used to compute every recipe's macros. Rather than parking it as a static page, we extract it into structured data and make it the source of truth for computing macros of user-built custom recipes.
*Why:* it unlocks the custom-recipe builder (D8) for free and keeps custom-recipe macros consistent with the book's own numbers.

**D3 — QR codes are decoded to a "Watch video" button, not shown as images.**
Each recipe page has a QR code encoding its YouTube URL. On a screen the QR itself is useless, so we decode it to the URL and render a clean video link/button. The QR image is dropped.

**D27 — "Lossless" means all *content*, not the physical packaging.**
We keep every piece of real content — recipes, techniques, pantry, intro, FAQ, illustrations — and preserve author/credits on an About page. We **drop** pages that only describe the book-as-an-object: the "how to read this book" page-breakdown, the dedication, the copyright page, the legal disclaimer. They're dead weight or actively misleading in an app (e.g. a guide to a PDF layout you're not using).
*Rejected:* reproducing literally every page (strictest lossless, but carries packaging cruft into the product).

---

## 2. Recipe data model

**D4 — Recipes are strongly typed records, with structured fields — not a blob of text.**
Each recipe captures: title, category, servings, macros (calories / fat / carbs / net carbs / protein), named ingredient groups (each a list of `{amount, unit, item}`), numbered directions, hero photo, video URL, **prep time**, **cook time**, and **tips**.
*Why typed:* the whole app (filtering by macros, scaling quantities, summing a shopping list) depends on the data being structured, not prose. Type-safety is a hard requirement.

**D5 — Tips are their own optional field, never a catch-all "notes" blob.**
Prep time, cook time, and tips are almost always present and each gets its own field. When a recipe has no tips, that section simply isn't rendered. We explicitly do **not** merge stray notes/callouts/equipment into a single freeform block — that would defeat the point of structured data.

**D6 — Extraction = read the rendered pages, structure to JSON, verify against the source.**
The PDF's text layer comes out partially scrambled (reading order breaks on the templated pages), so a naïve text scrape would silently lose or jumble data — unacceptable given "lossless." Instead we render each page and structure it into the typed model, checking the result against the page as ground truth.
*Rejected:* an external multimodal/embedding model (e.g. Gemini Embedding 2) — overkill for ~150 recipes, adds an API dependency, and embeddings solve retrieval, not extraction. Client-side fuzzy search (D7) covers search without it.

---

## 3. Features

**D7 — Browse = fuzzy text search + category filter + macro-range filters + auto-tags & sort.**
The core value over a PDF. Search is instant and client-side (the dataset is small). Macro-range filters answer the real questions ("high protein, under 500 cal"). Auto-tags are **derived from data we already have** — macro-based (High Protein, Low Calorie, etc.), time-based (Under 30 min), and light meal-type cross-tags (Dessert, Snack…).
*Rejected:* dietary tags (vegetarian/vegan) — they can't be derived reliably from ingredient names without guessing, and a wrong "vegan" label is worse than none.

**D8 — Custom recipe builder, with local save.**
You pick ingredients from the ingredient database (D2) with quantities; macros compute automatically using the book's methodology; you save the result. Custom recipes appear alongside book recipes and are searchable/filterable like any other.

**D31 — Custom recipes have full structure, minus a photo.**
A custom recipe carries name, ingredient lines (from the DB, auto-computing macros), servings, optional grouped sections, and optional directions — so it behaves like a book recipe everywhere (planner, shopping list, scaler). No photo upload, which deliberately avoids needing image storage (keeps us on "images bundled statically", D18).
*Rejected:* a minimal save-able macro calculator (too thin to plan/cook from); photo upload (would pull in Firebase Storage + rules).

**D32 — Book recipes are read-only, but each person can attach personal notes.**
The book content stays faithful and unedited. Each person can add their own notes to any recipe ("I use half the salt", "+2 min"); notes are per-person and Mutually-Viewable (D15), like favorites. Editing a book recipe's actual content is not supported.
*Rejected:* strictly read-only with no notes (loses an easy QoL win the PDF can't do); fork-to-custom on edit (clutters the library with near-duplicates).

**D9 — Serving scaler recomputes both quantities and macros.**
Pick a target serving count; ingredient amounts **and** macros recompute live. This is why ingredient quantities are parsed into `{amount, unit, item}` (D4) rather than kept as text.

**D10 — Cooking mode: distraction-free, step-by-step, screen stays awake.**
A large-type, one-step-at-a-time view launched from a recipe, with a wake-lock so the screen doesn't sleep mid-cook. The one kitchen-ergonomics feature we're building.
*Rejected (for now):* installable PWA, full offline support, and unit conversion — deliberately out (D20).

---

## 4. Cross-references & navigation

Turning the book's page-flips into taps is one of the app's biggest wins over the PDF. The book references things **by name, never by page number** — so every link below is resolved by name at render time.

**D21 — Capitalized in-step references become links, resolved local-first.**
Steps constantly name capitalized things — "add the **Dry Ingredients**," "layer the **FILLING**," "shape the **DOUGH**" (the book's own system: groups are capitalized in directions so you can find them). Each is resolved on render: if it matches an **ingredient group in the same recipe**, tapping highlights/scrolls to that group; if it matches **another recipe's title** (e.g. "FOOLPROOF HOMEMADE MARINARA"), it becomes a jump-link to that recipe. A name matching neither stays plain text — no broken links.

**D22 — Recipe → recipe jumps for named references.**
The inter-recipe branch of the same resolver (D21): when a recipe names another recipe or shared sub-procedure, it's tap-to-jump.

**D23 — Video-timestamp references deep-link into the video.**
"refer to timestamp 5:03 in the video" renders as a link that opens the recipe's YouTube video at that moment (`&t=303s`), building on the decoded video link from D3.

**D24 — Shared sub-procedures are standalone, linkable entries.**
Reusable procedures referenced by many recipes (a marinara, the pizza doughs, the "Deep Dish Process" spread) are extracted **once** as their own entries; every recipe that uses one links to it (via D22). Single source of truth, no duplicated content.
*Rejected:* inline-duplicating the procedure into every recipe (duplication, heavier pages).

**D25 — Auto "related recipes" suggestions, derived from data.**
Beyond the book's explicit references, each recipe surfaces a few related ones computed from same category / shared key ingredients / similar macro profile. Pure discovery, no manual tagging.

**Dropped — ingredient → macro-database links.** We considered making each recipe ingredient tap through to its row in the ingredient database, and decided against it. The ingredient database still powers the custom builder (D2, D8), but recipe ingredients are not individually linked to it.

---

## 5. Weekly planning & shopping

**D11 — The week is 7 days, freeform list per day (no fixed meal slots).**
You add recipes (book or custom) to a day; no enforced Breakfast/Lunch/Dinner structure. Simpler to use and to build. The planner is for organizing meals and generating the shopping list — it is **not** an intake/goal tracker (see out-of-scope, §10).

**D29 — Navigable, date-keyed weeks with light history.**
You can move between weeks (this week / next week) to plan ahead; planned weeks persist as history rather than being overwritten. Keyed by week date.
*Rejected:* a single rolling week (no history) and free-form named plans (loses the weekly grocery cadence).

**D12 — Each planned recipe carries a serving count that drives totals and the shopping list.**
The servings you set on a planned recipe feed both that day's macro totals and the quantities that flow into the shopping list.

**D13 — The shopping list sums matching item+unit, keeps mismatched units separate, and groups by store category.**
`200g chicken` + `100g chicken` → `300g chicken`. `1 onion` + `150g onion` stay as two lines — we never auto-convert units, because a wrong conversion silently corrupts the quantity you shop for. Items are grouped into basic store categories (produce / dairy / meat / pantry / …) and checked off as you gather them.
*Rejected:* aggressive unit auto-conversion (tidier list, but can mislead) and no-summing-at-all (forces you to add things up in the store).

**D30 — The shopping list is a stable snapshot generated from the plan, not a live mirror.**
You hit "generate" to build the list from a week's recipes; it then stays put while you shop (a list that shifts mid-aisle because someone edited the plan is a bug, not a feature). The snapshot is the Joint, live-synced object both phones share (D15). You can add manual ad-hoc items (paper towels, etc.) and check items off — both persist. Re-generating after a plan change prompts to replace or merge.
*Rejected:* a live list that always mirrors the plan (unstable in-store); a purely manual list (loses the plan→list automation).

**D14 — Romanian-store aisle ordering is explicitly NOT in this build.**
The owner will later add AI-driven ordering of the list to match the layout of specific Romanian stores. We leave a clean seam for it but don't build it now.

---

## 6. Sharing & ownership  → see `docs/adr/0003`

**D15 — "Shared" is split into two precise models: Joint and Mutually-Viewable.**
A single vague "shared" notion caused confusion, so we separated it:
- **Joint** — one shared object both people edit and see identically. Applies to the **weekly meal plan** and the **shopping list**, because cooking and shopping happen together (and the list must be live-synced to both phones in the store).
- **Mutually-Viewable** — each person owns their own set and can view the other's, but the sets are **never merged**. Applies to **favorites** and **custom recipes**: you each keep your own, and can peek at the other's.

---

## 7. Auth, privacy & the copyright posture  → see `docs/adr/0001`

**D17 — The whole app requires Google sign-in; Firestore data is locked to the two users' accounts.**
Sign-in is the gate to use the app at all. Security rules restrict all personal data to the two known account UIDs, so nobody else can read or touch the meal plan / shopping list / favorites.
*Why Google:* no passwords to manage, both users already have accounts, minimal setup.

**D18 — The recipe content is public; we accept that tradeoff knowingly.**
Free GitHub Pages serves a static bundle, so the recipe text and images are publicly downloadable and committed to a public repo — there's no real way to keep content private on this tier. We chose this anyway: it's a personal tool from a book the owner has, low-profile, no clean URL, and free.
*Consequence:* the login gate (D17) protects personal data but **not** the book content. Changing that later means moving content delivery behind auth — a real re-architecture. Recorded in ADR-0001.

---

## 8. Technology  → see `docs/adr/0002`

**D19 — Vite + React + TypeScript + Tailwind + framer-motion + zod + bun, with Firebase as the data/auth layer.**
This is the owner's house stack (minus Next.js, which we drop since there's no server need). All features run client-side; recipe content ships in the bundle. Synced personal data lives in **Firestore**, gated by Google auth.
*Why Firebase:* already operated daily by the owner, free tier covers two users easily, and it gives auth + sync + rules without us running a backend. This is the project's main lock-in (ADR-0002).
*Why Vite over Next:* a pure client SPA is lighter and simpler than Next for an app with no server-rendered pages.

**Hosting — GitHub Pages, deployed from `github.com/sergiulache/macro-cookbook` (public) via Actions.**
One platform, free, fits the static SPA. `gh` is already authenticated as `sergiulache`; the Firebase CLI needs a one-time interactive `firebase login` from the owner plus a new Firebase project.

**D26 — Real client-side routing: every recipe, plan, list, and reference page is a stable, shareable URL.**
The two users send each other recipes, so a recipe must be a link you can paste ("here's the Smashburger"). Browser back/forward and refresh preserve position. Login still gates every route.

**D28 — Data is strictly online; no offline cache.**
Firestore's built-in offline persistence was offered (it would let the shopping list survive a dead-zone store and sync later) and **declined** — the app requires a live connection to load data. Simpler; the owner accepts the risk of bad in-store signal.

**D33 — Targeted testing: zod data validation + pure-logic unit tests only.**
Since the app is LLM-built end-to-end, tests exist to catch the bugs that are *invisible on screen*, not to chase coverage. A **zod schema gates every extracted recipe** (required fields, numeric macros, parseable `{amount, unit, item}`) — turning the lossless requirement into a build-time check. **Vitest unit tests** cover the silent-failure logic: serving scaler math, macro/shopping-list aggregation (item+unit summing), and the reference resolver. **No component, e2e, or snapshot tests** — UI/animation/navigation correctness is verified by running the app.
*Why:* a wrong macro or mis-summed quantity looks fine but fails you in the kitchen/store; a layout glitch is visible. Test the former, eyeball the latter. A full suite would be maintenance debt for a two-person app.

---

## 9. Design

**D20 — Strict monochrome (the `DESIGN.md` / Ollama language); food photos are the only color; light mode only.**
All chrome stays black / white / gray with no shadows or accent colors. The food photography is the sole source of color and will pop hard against the paper-white canvas. We honor the design language rather than bending it, so no dark mode for now.

**D34 — Motion is polished & restrained spring physics, carrying the personality the flat visuals don't.**
The design language is intentionally static (no shadows/gradients/hover states), so the "smooth animations" requirement is met through *transitions and physics*, not visual ornament — Linear/Vercel-grade subtlety via framer-motion. Signature moments: **shared-element card→detail** (photo morphs into the recipe page), **animated list reflow** on search/filter/sort, **number tweening** on the serving scaler, **route transitions + micro-interactions** (check-offs, stars, taps), and other tasteful transitions where they fit. Backed by a **small set of reusable animated primitives** (e.g. fade-in, animated-number, reflow-list, shared-layout wrappers) so motion stays consistent — kept minimal, explicitly not over-engineered.

---

## 10. Deliberately out of scope (for this build)

- Installable PWA / offline caching / unit conversion (D10).
- AI Romanian-store aisle ordering (D14) — owner's later, separate task.
- Dietary auto-tags (D7) — unreliable to infer.
- Dark mode (D20).
- Keeping the book content private (D18) — accepted as public.
- Daily calorie/macro **goal tracking** — the owner uses a dedicated calorie-tracking app for that. The planner organizes meals and feeds the shopping list; it does not track intake against a target.
- Offline data cache (D28) — declined; the app is online-only.
- Artifact-only book pages (D27) — dedication, copyright, legal disclaimer, page-breakdown explainer.
- Ingredient → macro-database links (D25 note).
