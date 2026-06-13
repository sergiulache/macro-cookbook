# Public site of copyrighted content, gated by login

The app rebuilds a copyrighted, all-rights-reserved ebook for two private users. We deploy it as a static site on free GitHub Pages, which means the recipe text and images are bundled into a publicly downloadable payload and committed to a public repo - there is no real way to keep the content private on this hosting tier. We accept that exposure deliberately (it's a personal tool built from a book the owner has, low profile, no clean URL) rather than paying for private hosting or re-architecting content delivery behind auth.

## Considered Options

- **Gate content behind auth** (recipes/images served from Firebase only after login): protects the content but adds a Firebase Storage image path with no public CDN, more build complexity, and worse image performance. Rejected for a two-person weekend tool.
- **Public static bundle (chosen):** simplest, fastest, best image performance; content is public.

## Consequences

The whole app still *requires* Google sign-in to use, and Firestore data is locked to the two users' UIDs - so personal data is protected even though the book content is not. If the content posture ever needs to change, content delivery must move behind auth, which is a meaningful re-architecture (see ADR-0002).
