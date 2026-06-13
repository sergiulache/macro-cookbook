import type { ReactNode } from "react";
import { useAuth } from "../lib/auth/auth";

/** Whole-app login gate (D17). Nothing loads until signed in. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, signIn } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-mute">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-hairline border-t-ink" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
        <div>
          <h1 className="font-display text-[34px] font-700 tracking-tight">Macro<span className="text-mute">Cookbook</span></h1>
          <p className="mt-2 text-body">Diet Cheat Codes, made fast. Sign in to continue.</p>
        </div>
        <button
          onClick={() => signIn().catch(() => {})}
          className="inline-flex h-11 items-center gap-3 rounded-full bg-ink px-6 font-500 text-canvas hover:bg-ink-deep"
        >
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#fff" d="M12 11v2.8h4c-.2 1-1.3 3-4 3a4.5 4.5 0 0 1 0-9c1.3 0 2.2.6 2.7 1l1.9-1.8A7.5 7.5 0 1 0 12 19.5c4.3 0 7.2-3 7.2-7.3 0-.5 0-.8-.1-1.2H12z"/></svg>
          Sign in with Google
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
