import type { NineRouterModel } from "./types.js";

/**
 * Regex matching non-chat models:
 * - Speech-to-text / ASR (e.g. nvidia/parakeet-ctc-1.1b-asr)
 * - Embeddings (e.g. text-embedding-3-small)
 * - Rerankers (e.g. bge-reranker)
 * - Text-to-speech (TTS)
 */
const NON_CHAT_ID_REGEX = /(?:^|\/|-|_)(asr|embedding|embed|rerank|reranker|tts|whisper|transcription)(?:$|\/|-|_)/i;

export function isChatModel(model: NineRouterModel): boolean {
  if (!model || typeof model.id !== "string" || !model.id.trim()) {
    return false;
  }

  const id = model.id.toLowerCase();

  // Explicit check against non-chat naming patterns
  if (NON_CHAT_ID_REGEX.test(id)) {
    return false;
  }

  // If capabilities are available, check if tools/reasoning/vision/chat capabilities exist
  // ASR models generally have tools=false, reasoning=false, vision=false
  const caps = model.capabilities;
  if (caps) {
    // If output is audio only and no reasoning/tools, it's not a chat model
    if (caps.audioOutput === true && caps.tools !== true && caps.reasoning !== true) {
      return false;
    }
  }

  return true;
}
