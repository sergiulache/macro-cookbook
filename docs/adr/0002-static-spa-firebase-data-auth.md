# Static SPA with a Firebase data and auth layer

The app is a Vite + React static single-page app: recipe content ships in the bundle, and there is no backend of our own. Synced personal data (joint meal plan + shopping list, per-person favorites + custom recipes, macro goals) lives in Firestore, and access is gated by Google sign-in with security rules restricted to the two users' account UIDs. We chose Firebase because the owner already operates it daily and its free tier comfortably covers two users - the alternative of building/operating any custom backend was not worth it for this scope.

## Consequences

This is the project's main lock-in: auth provider, data store, and security model are all Firebase. Swapping it later means replacing the entire data layer. The static frontend and the Firebase data layer are independently deployable (GitHub Pages for the SPA, Firebase for data) - neither hosts the other.
