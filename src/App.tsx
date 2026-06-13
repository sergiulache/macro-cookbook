import { HashRouter, Routes, Route, Link } from "react-router-dom";
import { BrowsePage } from "./features/browse/BrowsePage";
import { RecipePage } from "./features/recipe/RecipePage";
import { CookingMode } from "./features/recipe/CookingMode";

function Nav() {
  return (
    <nav className="sticky top-0 z-20 border-b border-hairline bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1100px] items-center justify-between px-5">
        <Link to="/" className="font-display text-[18px] font-700 tracking-tight">
          Macro<span className="text-mute">Cookbook</span>
        </Link>
        <span className="text-[12px] text-mute">Diet Cheat Codes</span>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Nav />
      <Routes>
        <Route path="/" element={<BrowsePage />} />
        <Route path="/r/:id" element={<RecipePage />} />
        <Route path="/r/:id/cook" element={<CookingMode />} />
        <Route path="*" element={<BrowsePage />} />
      </Routes>
    </HashRouter>
  );
}
