# Joint vs Mutually-Viewable data ownership

Data is split by two distinct sharing semantics rather than a single "shared" notion. The **Meal Plan** and **Shopping List** are *Joint* - one shared object both people edit and see identically, because cooking and shopping happen together. **Favorites** and **Custom Recipes** are *Mutually Viewable* - each person owns their own set and can view the other's, but the sets are never merged into one pile. Macro goals are personal.

## Consequences

The Firestore schema must distinguish the two: Joint data is a single shared document/collection both UIDs can write; Mutually-Viewable data is per-owner (keyed by UID) and readable by both. "Shared" is deliberately avoided as a term because it's ambiguous between these two models (see CONTEXT.md).
