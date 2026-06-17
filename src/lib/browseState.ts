/**
 * Persist the browse view (search, filters, sort, page, scroll) to localStorage
 * so returning from a recipe restores where you were instead of resetting. This
 * is per-device UI state, not synced data, so localStorage (not Firestore) is
 * the right home.
 */
export interface BrowseState {
  q: string;
  cats: string[];
  tags: string[];
  sort: string;
  favView: string;
  page: number;
  scrollY: number;
}

const KEY = "mc.browse.v1";

export function loadBrowseState(): Partial<BrowseState> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

export function patchBrowseState(patch: Partial<BrowseState>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...loadBrowseState(), ...patch }));
  } catch {
    /* storage unavailable (private mode); ignore */
  }
}
