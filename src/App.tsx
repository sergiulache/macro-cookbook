import { useEffect } from "react";
import { HashRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { BrowsePage } from "./features/browse/BrowsePage";
import { RecipePage } from "./features/recipe/RecipePage";
import { CookingMode } from "./features/recipe/CookingMode";
import { AuthProvider, useAuth } from "./lib/auth/auth";
import { AuthGate } from "./components/AuthGate";

/** Reset scroll to top on every route change (so a recipe opens at its top). */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

function Nav() {
  const { user, logout } = useAuth();
  return (
    <nav className="sticky top-0 z-20 border-b border-hairline bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1100px] items-center justify-between px-5">
        <Link to="/" className="font-display text-[18px] font-700 tracking-tight">
          Macro<span className="text-mute">Cookbook</span>
        </Link>
        <button onClick={() => logout()} className="text-[12px] text-mute hover:text-ink" title={user?.email ?? ""}>
          Sign out
        </button>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <ScrollToTop />
        <AuthGate>
          <Nav />
          <Routes>
            <Route path="/" element={<BrowsePage />} />
            <Route path="/r/:id" element={<RecipePage />} />
            <Route path="/r/:id/cook" element={<CookingMode />} />
            <Route path="*" element={<BrowsePage />} />
          </Routes>
        </AuthGate>
      </HashRouter>
    </AuthProvider>
  );
}
