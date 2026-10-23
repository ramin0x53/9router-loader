import { describe, it, expect, vi, beforeEach } from "vitest";
import NineRouterLoaderPlugin, { createLegacy9RouterPlugin } from "../src/plugin.js";
import * as clientModule from "../src/client.js";
import type { OpenCodeV2PluginContext, OpenCodeV2ProviderEditor } from "../src/types.js";

describe("plugin - NineRouterLoaderPlugin (OpenCode v2 & v1)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("exports valid OpenCode v2 plugin definition with id and setup()", () => {
    expect(NineRouterLoaderPlugin).toBeDefined();
    expect(typeof NineRouterLoaderPlugin).toBe("object");
    expect(NineRouterLoaderPlugin.id).toBe("opencode-9router-loader");
    expect(typeof NineRouterLoaderPlugin.setup).toBe("function");
  });

  it("populates 9router models via OpenCode v2 ctx.provider.transform and preserves user overrides", async () => {
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

    const records = new Map<
      string,
      { provider: Record<string, any>; models: Map<string, Record<string, any>> }
    >();

    const getOrCreateRecord = (id: string) => {
      let rec = records.get(id);
      if (!rec) {
        rec = { provider: { id }, models: new Map() };
        records.set(id, rec);
      }
      return rec;
    };

    const providerEditor: OpenCodeV2ProviderEditor = {
      list: () => Array.from(records.values()),
      get: (id) => records.get(id),
      update: (id, fn) => {
        const rec = getOrCreateRecord(id);
        fn(rec.provider);
      },
      models: {
        update: (providerID, modelID, fn) => {
          const rec = getOrCreateRecord(providerID);
          const draft = rec.models.get(modelID) ?? { id: modelID, providerID };
          fn(draft);
          rec.models.set(modelID, draft);
        },
      },
    };

    const transforms: Array<(editor: OpenCodeV2ProviderEditor) => void> = [];

    const ctx: OpenCodeV2PluginContext = {
      location: { directory: "/tmp/nonexistent-9router-test-dir" },
      options: {
        providers: {
          other_provider: {
            settings: {
              baseURL: "https://some-other.com/v1",
            },
          },
          "9router": {
            name: "9Router Local",
            package: "@opencode/ai/providers/openai-compatible",
            settings: {
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
      },
      provider: {
        transform: async (cb) => {
          transforms.push(cb);
        },
      },
    };

    await NineRouterLoaderPlugin.setup(ctx);

    // Run registered provider transforms
    for (const runTransform of transforms) {
      runTransform(providerEditor);
    }

    // Only queried 9router, ignored other_provider
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith({
      baseURL: "https://9router.example.com/v1",
      apiKey: "sk-test",
      timeoutMs: 8000,
    });

    const nineRouterRecord = records.get("9router");
    expect(nineRouterRecord).toBeDefined();
    expect(nineRouterRecord?.provider.activation).toBe("enabled");
    expect(nineRouterRecord?.provider.package).toBe("@opencode/ai/providers/openai-compatible");

    // Filtered out ASR model
    expect(nineRouterRecord?.models.get("nvidia/parakeet-ctc-1.1b-asr")).toBeUndefined();

    // Injected chat model and preserved user override
    const geminiModel = nineRouterRecord?.models.get("ag/gemini-3.8-flash-high");
    expect(geminiModel).toBeDefined();
    expect(geminiModel?.name).toBe("custom-user-override-name");
    expect(geminiModel?.modelID).toBe("ag/gemini-3.8-flash-high");
    expect(geminiModel?.capabilities.tools).toBe(true);
    expect(geminiModel?.capabilities.input).toEqual(["text", "image"]);
    expect(geminiModel?.limit.context).toBe(1048576);
    expect(geminiModel?.variants).toHaveLength(3);
  });

  it("supports legacy v1 config hook and preserves user overrides", async () => {
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

    const pluginHooks = await createLegacy9RouterPlugin({});

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

    await pluginHooks.config(config as any);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(config.provider["9router"].models["nvidia/parakeet-ctc-1.1b-asr"]).toBeUndefined();

    const geminiModel = config.provider["9router"].models["ag/gemini-3.8-flash-high"] as any;
    expect(geminiModel).toBeDefined();
    expect(geminiModel.name).toBe("custom-user-override-name");
    expect(geminiModel.tool_call).toBe(true);
    expect(geminiModel.limit?.context).toBe(1048576);
  });
});
