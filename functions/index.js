/**
 * Gemini proxy for the Macro Cookbook (D14 / AI layer). The Gemini key cannot
 * ship in the public web bundle (Google auto-disables exposed keys), so all
 * model calls go through this callable function: it holds the key as a Secret
 * Manager secret, is gated to the two member accounts, fetches a YouTube video's
 * text description for "youtube" sources (browser CORS blocks that), calls
 * gemini-3.1-flash-lite with an optional responseSchema, and returns the text
 * plus token usage. Rate-limit (429) is surfaced as a distinct error the UI
 * shows loudly. Only the free-tier flash-lite model is used.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

const GEMINI_KEY = defineSecret("GEMINI_KEY");
const MEMBERS = new Set([
  "LDl4A6ilzUdGJOsgVLq5CWUg2PA2", // Sergiu
  "B2eHoIgwDqhPDZvu1P8iC3Gpefq2", // Ane
]);
const MODEL = "gemini-3.1-flash-lite";

const videoId = (u) => {
  const m = String(u).match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/);
  return m ? m[1] : null;
};

async function fetchYouTube(url) {
  const id = videoId(url);
  if (!id) return null;
  try {
    const r = await fetch(`https://www.youtube.com/watch?v=${id}&hl=en`, {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        "accept-language": "en-US,en;q=0.9",
      },
    });
    const html = await r.text();
    const g = (re) => {
      const m = html.match(re);
      try { return m ? JSON.parse('"' + m[1] + '"') : null; } catch { return null; }
    };
    return { title: g(/"title":"((?:[^"\\]|\\.)*)"/), description: g(/"shortDescription":"((?:[^"\\]|\\.)*)"/) };
  } catch {
    return null;
  }
}

export const aiGenerate = onCall(
  { secrets: [GEMINI_KEY], region: "europe-west1", timeoutSeconds: 120, memory: "256MiB" },
  async (request) => {
    if (!request.auth || !MEMBERS.has(request.auth.uid)) {
      throw new HttpsError("permission-denied", "Sign in with a member account to use AI.");
    }
    const { systemPrompt, sources = [], schema, task = "", includeVideo = false } = request.data ?? {};
    if (!Array.isArray(sources) || sources.length === 0) {
      throw new HttpsError("invalid-argument", "No sources provided.");
    }

    const parts = [];
    let textBlock = "";
    for (const s of sources) {
      if (!s || typeof s.content !== "string" || !s.content.trim()) continue;
      if (s.type === "youtube") {
        const yt = await fetchYouTube(s.content);
        textBlock += yt && (yt.description || yt.title)
          ? `\n\n[YouTube video: ${yt.title ?? ""}]\nDescription:\n${yt.description ?? "(no description)"}\n`
          : `\n\n[YouTube link, description unavailable]: ${s.content}\n`;
        if (includeVideo) parts.push({ fileData: { fileUri: s.content } });
      } else if (s.type === "notes") {
        textBlock += `\n\n[Cook's notes / preferences]\n${s.content}\n`;
      } else {
        textBlock += `\n\n[Pasted recipe]\n${s.content}\n`;
      }
    }
    if (!textBlock.trim() && parts.length === 0) {
      throw new HttpsError("invalid-argument", "Sources had no usable content.");
    }
    parts.unshift({ text: `${task}\n${textBlock}`.trim() });

    const body = {
      systemInstruction: systemPrompt ? { parts: [{ text: String(systemPrompt) }] } : undefined,
      contents: [{ parts }],
      generationConfig: { temperature: 0.2, ...(schema ? { responseMimeType: "application/json", responseSchema: schema } : {}) },
    };

    let res;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY.value()}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      throw new HttpsError("unavailable", "Could not reach the AI service. Try again.");
    }
    const j = await res.json();
    if (j.error) {
      if (j.error.code === 429) throw new HttpsError("resource-exhausted", "Gemini free-tier limit reached. Wait a bit and try again.");
      throw new HttpsError("internal", `AI error: ${j.error.status || j.error.code} ${String(j.error.message || "").slice(0, 200)}`);
    }
    const text = (j.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    if (!text.trim()) throw new HttpsError("internal", "AI returned an empty response.");
    return { text, usage: j.usageMetadata ?? null };
  },
);
