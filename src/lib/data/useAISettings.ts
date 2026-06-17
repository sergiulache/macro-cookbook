import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/auth";
import { nameFor } from "./people";
import { DEFAULT_SYSTEM_PROMPT } from "../ai/prompt";
import type { AiUsage } from "../ai/ai";

interface Tokens { input: number; output: number; calls: number }
export interface PromptVersion { prompt: string; at: number }

/**
 * AI settings. The system prompt is JOINT (D15): one shared instruction set both
 * people edit, stored at joint/aiSettings with an "updated at/by" stamp and a
 * light history of the last 5 previous versions for quick rollback. Token usage
 * stays per-person at users/{uid}.
 */
export function useAISettings() {
  const { user } = useAuth();
  const [systemPrompt, setLocal] = useState(DEFAULT_SYSTEM_PROMPT);
  const [updatedAt, setUpdatedAt] = useState(0);
  const [updatedBy, setUpdatedBy] = useState("");
  const [history, setHistory] = useState<PromptVersion[]>([]);
  const [tokens, setTokens] = useState<Tokens>({ input: 0, output: 0, calls: 0 });

  useEffect(() => {
    if (!user) return;
    const u1 = onSnapshot(doc(db, "joint", "aiSettings"), (snap) => {
      const d = snap.data();
      setLocal((d?.systemPrompt as string)?.trim() ? (d!.systemPrompt as string) : DEFAULT_SYSTEM_PROMPT);
      setUpdatedAt((d?.systemPromptUpdatedAt as number) ?? 0);
      setUpdatedBy((d?.systemPromptUpdatedBy as string) ?? "");
      setHistory((d?.systemPromptHistory as PromptVersion[]) ?? []);
    });
    const u2 = onSnapshot(doc(db, "users", user.uid), (snap) => {
      const t = snap.data()?.aiTokens as Tokens | undefined;
      if (t) setTokens({ input: t.input ?? 0, output: t.output ?? 0, calls: t.calls ?? 0 });
    });
    return () => { u1(); u2(); };
  }, [user]);

  /** Save a new shared prompt, pushing the current one into history (cap 5). */
  const writePrompt = (next: string) => {
    if (!user || next === systemPrompt) return;
    const pushCurrent = !(systemPrompt === DEFAULT_SYSTEM_PROMPT && !updatedAt);
    const newHistory = pushCurrent ? [{ prompt: systemPrompt, at: updatedAt || Date.now() }, ...history].slice(0, 5) : history;
    return setDoc(doc(db, "joint", "aiSettings"), {
      systemPrompt: next,
      systemPromptUpdatedAt: Date.now(),
      systemPromptUpdatedBy: user.uid,
      systemPromptHistory: newHistory,
    }, { merge: true });
  };

  const addUsage = (u: AiUsage) =>
    user && setDoc(doc(db, "users", user.uid), {
      aiTokens: { input: tokens.input + (u.promptTokenCount ?? 0), output: tokens.output + (u.candidatesTokenCount ?? 0), calls: tokens.calls + 1 },
    }, { merge: true });

  return {
    systemPrompt,
    isDefault: systemPrompt === DEFAULT_SYSTEM_PROMPT,
    updatedAt,
    updatedByName: updatedBy ? nameFor(updatedBy) : "",
    history,
    setSystemPrompt: (p: string) => writePrompt(p),
    resetSystemPrompt: () => writePrompt(DEFAULT_SYSTEM_PROMPT),
    restoreVersion: (p: string) => writePrompt(p),
    tokens,
    addUsage,
  };
}
