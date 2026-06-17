import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/auth";
import { DEFAULT_SYSTEM_PROMPT } from "../ai/prompt";
import type { AiUsage } from "../ai/ai";

interface Tokens { input: number; output: number; calls: number }

/**
 * Per-person AI settings: the editable system prompt (personalization memory)
 * and cumulative token usage, stored at users/{uid}. The prompt defaults to a
 * strong starting point and can be tuned per person.
 */
export function useAISettings() {
  const { user } = useAuth();
  const [systemPrompt, setLocal] = useState(DEFAULT_SYSTEM_PROMPT);
  const [tokens, setTokens] = useState<Tokens>({ input: 0, output: 0, calls: 0 });

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "users", user.uid), (snap) => {
      const d = snap.data();
      setLocal((d?.aiSystemPrompt as string)?.trim() ? (d!.aiSystemPrompt as string) : DEFAULT_SYSTEM_PROMPT);
      const t = d?.aiTokens as Tokens | undefined;
      if (t) setTokens({ input: t.input ?? 0, output: t.output ?? 0, calls: t.calls ?? 0 });
    });
  }, [user]);

  const setSystemPrompt = (p: string) =>
    user && setDoc(doc(db, "users", user.uid), { aiSystemPrompt: p }, { merge: true });
  const resetSystemPrompt = () =>
    user && setDoc(doc(db, "users", user.uid), { aiSystemPrompt: DEFAULT_SYSTEM_PROMPT }, { merge: true });

  const addUsage = (u: AiUsage) =>
    user && setDoc(doc(db, "users", user.uid), {
      aiTokens: {
        input: tokens.input + (u.promptTokenCount ?? 0),
        output: tokens.output + (u.candidatesTokenCount ?? 0),
        calls: tokens.calls + 1,
      },
    }, { merge: true });

  return { systemPrompt, setSystemPrompt, resetSystemPrompt, isDefault: systemPrompt === DEFAULT_SYSTEM_PROMPT, tokens, addUsage };
}
