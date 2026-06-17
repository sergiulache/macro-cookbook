import { httpsCallable, type HttpsCallableResult } from "firebase/functions";
import { functions } from "../firebase";
import { AiRecipeDraft, IMPORT_RESPONSE_SCHEMA } from "./importSchema";
import type { CustomLine } from "../schema/custom";

export interface AiUsage { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number }
export interface Source { type: "text" | "youtube" | "notes"; content: string }

interface AiRequest { sources?: Source[]; systemPrompt?: string; schema?: unknown; task?: string; includeVideo?: boolean; imageQuery?: string }
interface AiResponse { text: string; usage: AiUsage | null; imageUrl?: string | null }

// video imports can take 30-40s on the model, so allow up to 2 minutes
const aiGenerate = httpsCallable<AiRequest, AiResponse>(functions, "aiGenerate", { timeout: 120000 });

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

/** Low-level call to the proxy; maps Firebase callable errors to a friendly AiError. */
export async function callAi(req: AiRequest): Promise<AiResponse> {
  try {
    const res: HttpsCallableResult<AiResponse> = await aiGenerate(req);
    return res.data;
  } catch (e) {
    const raw = (e as { code?: string; message?: string }) ?? {};
    const code = (raw.code ?? "internal").replace(/^functions\//, "");
    throw new AiError(code, friendly(code, raw.message ?? ""));
  }
}

/** Run the recipe importer: sources + system prompt -> validated draft + token usage. */
export async function importRecipe(sources: Source[], systemPrompt: string): Promise<{ draft: AiRecipeDraft; usage: AiUsage }> {
  const clean = sources.filter((s) => s.content.trim());
  if (!clean.length) throw new AiError("invalid-argument", "Add at least one source (text, a YouTube link, or notes).");

  const data = await callAi({
    sources: clean,
    systemPrompt,
    schema: IMPORT_RESPONSE_SCHEMA,
    task: "Build ONE structured recipe from the following source(s).",
  });

  let json: unknown;
  try { json = JSON.parse(data.text); }
  catch { throw new AiError("parse", "The AI response was not valid. Try again, or simplify the input."); }

  const parsed = AiRecipeDraft.safeParse(json);
  if (!parsed.success) throw new AiError("schema", "The AI could not build a complete recipe from that. Add more detail or another source.");
  return { draft: parsed.data, usage: data.usage ?? {} };
}

/** Best-effort food photo for a recipe (free CC image via the proxy). Null if none. */
export async function searchImage(query: string): Promise<string | null> {
  if (!query.trim()) return null;
  try {
    const res = await aiGenerate({ imageQuery: query });
    return res.data.imageUrl ?? null;
  } catch {
    return null;
  }
}

/** Convert a validated draft into builder lines (snapshot macros, source "ai"). */
export function draftToLines(draft: AiRecipeDraft): CustomLine[] {
  return draft.ingredients.map((i) => ({
    ingredientId: `ai-${crypto.randomUUID()}`,
    name: i.name,
    source: "ai" as const,
    ...(i.optional ? { optional: true } : {}),
    grams: i.grams,
    per: { amount: Math.max(i.grams, 1), unit: "g" },
    macros: { calories: i.calories, fat: i.fat, carbs: i.carbs, netCarbs: null, protein: i.protein },
  }));
}
