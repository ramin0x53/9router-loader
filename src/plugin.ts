import type { Plugin, PluginInput, PluginOptions } from "@opencode-ai/plugin";
import { is9RouterProvider } from "./detector.js";
import { isChatModel } from "./filter.js";
import { map9RouterModelToOpenCode } from "./mapper.js";
import { fetch9RouterModels } from "./client.js";
import type { OpenCodeModelConfig, OpenCodeProviderConfig } from "./types.js";

export const NineRouterLoaderPlugin: Plugin = async (_input: PluginInput, options?: PluginOptions) => {
  const timeoutMs = typeof options?.timeoutMs === "number" ? options.timeoutMs : 8000;

  return {
    config: async (config: any) => {
      if (!config || typeof config !== "object" || !config.provider || typeof config.provider !== "object") {
        return;
      }

      for (const [providerId, providerVal] of Object.entries(config.provider)) {
        // Rule: Only process providers whose ID/key starts with "9router"
        if (!is9RouterProvider(providerId)) {
          continue;
        }

        const provider = providerVal as OpenCodeProviderConfig;
        const baseURL = provider.options?.baseURL;
        if (!baseURL || typeof baseURL !== "string") {
          continue;
        }

        const apiKey = typeof provider.options?.apiKey === "string" ? provider.options.apiKey : undefined;

        let discoveredModels: Record<string, OpenCodeModelConfig> | null = null;

        try {
          const rawModels = await fetch9RouterModels({
            baseURL,
            apiKey,
            timeoutMs,
          });

          // Filter non-chat models and map to OpenCode model configurations
          const mapped: Record<string, OpenCodeModelConfig> = {};
          for (const model of rawModels) {
            if (isChatModel(model)) {
              mapped[model.id] = map9RouterModelToOpenCode(model);
            }
          }

          discoveredModels = mapped;
        } catch (err) {
          console.warn(`[9router-loader] Failed to fetch models for provider "${providerId}":`, err instanceof Error ? err.message : String(err));
        }

        if (discoveredModels && Object.keys(discoveredModels).length > 0) {
          const existingModels = provider.models ?? {};
          const mergedModels: Record<string, OpenCodeModelConfig> = {};

          // First add discovered models
          for (const [id, model] of Object.entries(discoveredModels)) {
            mergedModels[id] = { ...model };
          }

          // Then merge user overrides on top of discovered models, or add custom models
          for (const [id, userModel] of Object.entries(existingModels)) {
            if (mergedModels[id]) {
              mergedModels[id] = {
                ...mergedModels[id],
                ...userModel,
              };
            } else {
              mergedModels[id] = userModel;
            }
          }

          provider.models = mergedModels;
        }
      }
    },
  };
};

export default NineRouterLoaderPlugin;
