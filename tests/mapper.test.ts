import { describe, it, expect } from "vitest";
import { map9RouterModelToOpenCode } from "../src/mapper.js";
import type { NineRouterModel } from "../src/types.js";

describe("mapper - map9RouterModelToOpenCode", () => {
  it("keeps exact id as model name and maps all capabilities correctly", () => {
    const raw: NineRouterModel = {
      id: "ag/gemini-3.8-flash-high",
      object: "model",
      owned_by: "ag",
      context_length: 1048576,
      max_completion_tokens: 65536,
      capabilities: {
        vision: true,
        pdf: false,
        audioInput: true,
        videoInput: true,
        imageOutput: false,
        audioOutput: false,
        tools: true,
        reasoning: true,
        contextWindow: 1048576,
        maxOutput: 65536,
      },
    };

    const mapped = map9RouterModelToOpenCode(raw);

    // Rule: exact ID as name
    expect(mapped.name).toBe("ag/gemini-3.8-flash-high");
    expect(mapped.tool_call).toBe(true);
    expect(mapped.reasoning).toBe(true);
    expect(mapped.attachment).toBe(true);
    expect(mapped.limit?.context).toBe(1048576);
    expect(mapped.limit?.output).toBe(65536);
    expect(mapped.modalities?.input).toEqual(["text", "image", "audio", "video"]);
    expect(mapped.modalities?.output).toEqual(["text"]);
  });

  it("handles fallback to context_length and max_completion_tokens when capabilities window omitted", () => {
    const raw: NineRouterModel = {
      id: "nvidia/deepseek-ai/deepseek-v4-pro",
      context_length: 1000000,
      max_completion_tokens: 65536,
      capabilities: {
        tools: true,
        reasoning: true,
        vision: false,
      },
    };

    const mapped = map9RouterModelToOpenCode(raw);

    expect(mapped.name).toBe("nvidia/deepseek-ai/deepseek-v4-pro");
    expect(mapped.tool_call).toBe(true);
    expect(mapped.reasoning).toBe(true);
    expect(mapped.attachment).toBe(false);
    expect(mapped.limit?.context).toBe(1000000);
    expect(mapped.limit?.output).toBe(65536);
    expect(mapped.modalities?.input).toEqual(["text"]);
  });
});
