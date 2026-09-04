import { describe, it, expect, vi, beforeEach } from "vitest";
import { NineRouterLoaderPlugin } from "../src/plugin.js";
import * as clientModule from "../src/client.js";

describe("plugin - NineRouterLoaderPlugin", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("only queries providers starting with 9router and preserves user overrides", async () => {
    const fetchSpy = vi.spyOn(clientModule, "fetch9RouterModels").mockResolvedValue([
      {
        id: "ag/gemini-3.8-flash-high",
        context_length: 1048576,
        max_completion_tokens: 65536,
        capabilities: {
          tools: true,
          reasoning: true,
          vision: true,
          contextWindow: 1048576,
          maxOutput: 65536,
        },
      },
      {
        id: "nvidia/parakeet-ctc-1.1b-asr",
        capabilities: {
          tools: false,
          reasoning: false,
        },
      },
    ]);

    const pluginHooks = await NineRouterLoaderPlugin({} as any);

    const config = {
      provider: {
        other_provider: {
          options: {
            baseURL: "https://some-other.com/v1",
          },
          models: {},
        },
        "9router": {
          options: {
            baseURL: "https://9router.example.com/v1",
            apiKey: "sk-test",
          },
          models: {
            "ag/gemini-3.8-flash-high": {
              name: "custom-user-override-name",
            },
          },
        },
      },
    };

    if (pluginHooks.config) {
      await pluginHooks.config(config as any);
    }

    // fetch was only called once (for 9router, not for other_provider)
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Filtered out ASR model
    expect(config.provider["9router"].models["nvidia/parakeet-ctc-1.1b-asr"]).toBeUndefined();

    // Injected and user override preserved
    const geminiModel = config.provider["9router"].models["ag/gemini-3.8-flash-high"];
    expect(geminiModel).toBeDefined();
    expect(geminiModel.name).toBe("custom-user-override-name"); // user override won!
    expect(geminiModel.tool_call).toBe(true);
    expect(geminiModel.limit?.context).toBe(1048576);
  });
});
