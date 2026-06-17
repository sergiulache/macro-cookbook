import { z } from "zod";
import { callAi, AiError, type AiUsage } from "./ai";
import { SHOPPING_SYSTEM_PROMPT } from "./prompt";
import type { ShopItem } from "../shopping/aggregate";

const TidyItem = z.object({
  name: z.string().min(1),
  name_ro: z.string().optional(),
  amount: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  approx: z.boolean().optional(),
  section: z.string().min(1),
});
const TidyResult = z.object({ items: z.array(TidyItem).min(1) });

const TIDY_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          name_ro: { type: "string" },
          amount: { type: "number" },
          unit: { type: "string" },
          approx: { type: "boolean" },
          section: { type: "string" },
        },
        required: ["name", "name_ro", "section"],
      },
    },
  },
  required: ["items"],
} as const;

/**
 * AI tidy of the shopping list (D14): merge duplicates/synonyms, collapse to a
 * single measurement (converting units, marked approximate), and order by the
 * household's store sections. Quantities become approximate by design here -
 * the owner asked for "1 egg + 50g eggs -> ~110g eggs".
 */
export async function tidyShoppingList(items: ShopItem[], sections: string[]): Promise<{ items: ShopItem[]; usage: AiUsage }> {
  if (!items.length) throw new AiError("invalid-argument", "Nothing to tidy yet.");
  const lines = items
    .map((i) => `${i.amount != null ? i.amount : ""} ${i.unit ?? ""} ${i.item}`.replace(/\s+/g, " ").trim())
    .join("\n");

  const data = await callAi({
    systemPrompt: SHOPPING_SYSTEM_PROMPT,
    sources: [
      { type: "text", content: "Shopping list lines:\n" + lines },
      { type: "notes", content: "Store sections, in the exact order to use:\n" + sections.join("\n") },
    ],
    schema: TIDY_SCHEMA,
    task: "Tidy this grocery list per the rules.",
  });

  let json: unknown;
  try { json = JSON.parse(data.text); }
  catch { throw new AiError("parse", "The AI response was not valid. Try again."); }
  const parsed = TidyResult.safeParse(json);
  if (!parsed.success) throw new AiError("schema", "The AI could not tidy the list. Try again.");

  const tidied: ShopItem[] = parsed.data.items.map((t) => ({
    id: "ai-" + crypto.randomUUID().slice(0, 8),
    item: t.name,
    name_ro: t.name_ro || t.name,
    amount: t.amount ?? null,
    unit: t.unit ?? null,
    category: t.section,
    checked: false,
    approx: t.approx ?? false,
  }));
  return { items: tidied, usage: data.usage ?? {} };
}
