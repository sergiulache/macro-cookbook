# Research Progress: Gemini model variants — audio support for video input

## Status: COMPLETE ✅

Final brief written to: /tmp/research_models.md

## Bottom line
- gemini-2.5-flash, gemini-2.5-flash-lite, gemini-3-flash, gemini-3.1-flash-lite ALL support
  video understanding WITH audio. No flash-lite "frame-only" carve-out exists in official docs.
- gemini-3.1-flash-lite DOES hear a video's audio (YES). Model page lists Audio input + ships an
  audio transcription example; Vertex video-understanding table lists it with "with audio" length.
- Audio is processed BY DEFAULT (File API: "audio is processed at 1Kbps (single channel)";
  32 tokens/sec). No flag needed.
- mediaResolution controls per-FRAME visual tokens only — it does NOT control/disable audio.
- The only official "without audio" statement is a max-LENGTH tradeoff: "with audio: ~45 min /
  without audio: ~1 hour" — identical for Flash, Flash-Lite and Pro (not a per-model gap).
- YouTube (Developer API): public-only, free tier 8h/day cap, paid no length limit, up to 10
  videos/request on 2.5+, feature in preview. (Vertex/Firebase wording differs: owned-or-public /
  public-or-unlisted, and Vertex allows only 1 YouTube URL per request.)

## Sources verified (read in full)
1. ai.google.dev/gemini-api/docs/video-understanding (primary)
2. docs.cloud.google.com/.../capabilities/video-understanding (per-model table, updated 2026-06-16)
3. ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite
4. ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-lite
5. ai.google.dev/gemini-api/docs/media-resolution
6. firebase.google.com/docs/ai-logic/input-file-requirements (cross-check)

## Not checked / assumptions
- No documented per-request "disable audio" flag in generateContent (audio on by default; mediaResolution
  doesn't toggle it). "Without audio" likely = source has no audio track. Treated as assumption.
- gemini-3-flash appears as "Gemini 3 Flash (preview)" on Vertex; ai.google.dev currently surfaces
  "Gemini 3.5 Flash" as current Flash. Consumer model card for gemini-3-flash may be preview/region-gated.
