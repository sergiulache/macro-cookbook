import { httpsCallable, type HttpsCallableResult } from "firebase/functions";
import { functions } from "../firebase";
import { AiRecipeDraft, IMPORT_RESPONSE_SCHEMA } from "./importSchema";
import type { CustomLine } from "../schema/custom";

export interface AiUsage { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number }
export interface Source { type: "text" | "youtube" | "notes"; content: string }

interface AiRequest { sources: Source[]; systemPrompt: string; schema?: unknown; task?: string; includeVideo?: boolean }
interface AiResponse { text: string; usage: AiUsage | null }

const aiGenerate = httpsCallable<AiRequest, AiResponse>(functions, "aiGenerate");

/** Typed error so the UI can show rate-limits and parse failures distinctly + loudly. */
export class AiError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}

function friendly(code: string, fallback: string): string {
  if (code === "resource-exhausted") return "AI limit reached for now (free tier). Wait a bit and try again.";
  if (code === "permission-denied") return "You need to be signed in with a member account.";
  if (code === "unavailable") return "Could not reach the AI service. Check your connection and retry.";
  return fallback || "AI request failed. Try again.";
}

/** Run the recipe importer: sources + system prompt -> validated draft + token usage. */
export async function importRecipe(sources: Source[], systemPrompt: string): Promise<{ draft: AiRecipeDraft; usage: AiUsage }> {
  const clean = sources.filter((s) => s.content.trim());
  if (!clean.length) throw new AiError("invalid-argument", "Add at least one source (text, a YouTube link, or notes).");

  let res: HttpsCallableResult<AiResponse>;
  try {
    res = await aiGenerate({
      sources: clean,
      systemPrompt,
      schema: IMPORT_RESPONSE_SCHEMA,
      task: "Build ONE structured recipe from the following source(s).",
    });
  } catch (e) {
    const raw = (e as { code?: string; message?: string }) ?? {};
    const code = (raw.code ?? "internal").replace(/^functions\//, "");
    throw new AiError(code, friendly(code, raw.message ?? ""));
  }

  let json: unknown;
  try { json = JSON.parse(res.data.text); }
  catch { throw new AiError("parse", "The AI response was not valid. Try again, or simplify the input."); }

  const parsed = AiRecipeDraft.safeParse(json);
  if (!parsed.success) throw new AiError("schema", "The AI could not build a complete recipe from that. Add more detail or another source.");
  return { draft: parsed.data, usage: res.data.usage ?? {} };
}

/** Convert a validated draft into builder lines (snapshot macros, source "ai"). */
export function draftToLines(draft: AiRecipeDraft): CustomLine[] {
  return draft.ingredients.map((i) => ({
    ingredientId: `ai-${crypto.randomUUID()}`,
    name: i.name,
    source: "ai" as const,
    grams: i.grams,
    per: { amount: Math.max(i.grams, 1), unit: "g" },
    macros: { calories: i.calories, fat: i.fat, carbs: i.carbs, netCarbs: null, protein: i.protein },
  }));
}
