import { describe, it, expect } from "vitest";
import { isChatModel } from "../src/filter.js";
import type { NineRouterModel } from "../src/types.js";

describe("filter - isChatModel", () => {
  it("allows chat LLMs", () => {
    const gemini: NineRouterModel = {
      id: "ag/gemini-3.8-flash-high",
      capabilities: {
        tools: true,
        reasoning: true,
        vision: true,
      },
    };
    expect(isChatModel(gemini)).toBe(true);

    const claude: NineRouterModel = {
      id: "cl/anthropic/claude-sonnet-4.6",
      capabilities: {
        tools: true,
        reasoning: true,
      },
    };
    expect(isChatModel(claude)).toBe(true);
  });

  it("filters out ASR / speech-to-text models", () => {
    const asr: NineRouterModel = {
      id: "nvidia/parakeet-ctc-1.1b-asr",
      capabilities: {
        tools: false,
        reasoning: false,
        vision: false,
      },
    };
    expect(isChatModel(asr)).toBe(false);

    const whisper: NineRouterModel = {
      id: "openai/whisper-large-v3",
    };
    expect(isChatModel(whisper)).toBe(false);
  });

  it("filters out embeddings and rerankers", () => {
    expect(isChatModel({ id: "text-embedding-3-small" })).toBe(false);
    expect(isChatModel({ id: "bge-reranker-large" })).toBe(false);
  });
});
