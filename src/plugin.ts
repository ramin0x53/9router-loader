import { is9RouterProvider } from "./detector.js";
import { isChatModel } from "./filter.js";
import {
  apply9RouterModelToV2Draft,
  applyUserModelOverrideToV2Draft,
  map9RouterModelToOpenCode,
} from "./mapper.js";
import { fetch9RouterModels } from "./client.js";
import { discover9RouterProviders } from "./config.js";
import type {
  DiscoveredNineRouterProvider,
  NineRouterModel,
  OpenCodeModelConfig,
  OpenCodeProviderConfig,
  OpenCodeV2PluginContext,
} from "./types.js";

export const PLUGIN_ID = "opencode-9router-loader";
const DEFAULT_PROVIDER_PACKAGE = "@opencode/ai/providers/openai-compatible";

interface ProviderRuntimeEntry {
  providerConfig: DiscoveredNineRouterProvider;
  models: NineRouterModel[];
}

async function resolveProviderApiKey(
  ctx: OpenCodeV2PluginContext,
  providerConfig: DiscoveredNineRouterProvider,
): Promise<string | undefined> {
  if (providerConfig.apiKey && providerConfig.apiKey.trim()) {
    return providerConfig.apiKey.trim();
  }

  try {
    const active = await ctx.integration?.connection?.active?.(providerConfig.id);
    if (active) {
      const resolved = await ctx.integration?.connection?.resolve?.(active);
      if (resolved && resolved.type === "key" && typeof resolved.key === "string" && resolved.key.trim()) {
        return resolved.key.trim();
      }
    }
  } catch {
    // Ignore credential lookup errors and proceed without API key
  }

  return undefined;
}

/**
 * Legacy OpenCode v1 `config` hook implementation.
 * Mutates `config.provider` (and `config.providers` if present) in-place for `9router*` providers.
 */
export async function applyLegacyConfigHook(
  config: Record<string, any>,
  options?: { timeoutMs?: number },
): Promise<void> {
  if (!config || typeof config !== "object") {
    return;
  }

  const timeoutMs = typeof options?.timeoutMs === "number" ? options.timeoutMs : 8000;
  const sections = [config.provider, config.providers].filter(
    (s): s is Record<string, any> => Boolean(s && typeof s === "object" && !Array.isArray(s)),
  );

  for (const section of sections) {
    for (const [providerId, providerVal] of Object.entries(section)) {
      if (!is9RouterProvider(providerId) || !providerVal || typeof providerVal !== "object") {
        continue;
      }

      const provider = providerVal as OpenCodeProviderConfig;
      const baseURL =
        provider.settings?.baseURL ??
        provider.options?.baseURL ??
        provider.baseURL ??
        provider.api;

      if (!baseURL || typeof baseURL !== "string") {
        continue;
      }

      const rawApiKey =
        provider.settings?.apiKey ?? provider.options?.apiKey ?? provider.apiKey;
      const apiKey = typeof rawApiKey === "string" ? rawApiKey : undefined;

      let discoveredModels: Record<string, OpenCodeModelConfig> | null = null;

      try {
        const rawModels = await fetch9RouterModels({
          baseURL,
          apiKey,
          timeoutMs,
        });

        const mapped: Record<string, OpenCodeModelConfig> = {};
        for (const model of rawModels) {
          if (isChatModel(model)) {
            mapped[model.id] = map9RouterModelToOpenCode(model);
          }
        }

        discoveredModels = mapped;
      } catch (err) {
        console.warn(
          `[9router-loader] Failed to fetch models for provider "${providerId}":`,
          err instanceof Error ? err.message : String(err),
        );
      }

      if (discoveredModels && Object.keys(discoveredModels).length > 0) {
        const existingModels = provider.models ?? {};
        const mergedModels: Record<string, OpenCodeModelConfig> = {};

        for (const [id, model] of Object.entries(discoveredModels)) {
          mergedModels[id] = { ...model };
        }

        for (const [id, userModel] of Object.entries(existingModels)) {
          if (mergedModels[id]) {
            mergedModels[id] = {
              ...mergedModels[id],
              ...(userModel as OpenCodeModelConfig),
            };
          } else {
            mergedModels[id] = userModel as OpenCodeModelConfig;
          }
        }

        provider.models = mergedModels;
      }
    }
  }
}

/**
 * Factory for OpenCode v1 style plugin `(input, options) => Promise<{ config }>`.
 */
export async function createLegacy9RouterPlugin(
  _input?: unknown,
  options?: { timeoutMs?: number },
) {
  return {
    config: async (config: Record<string, any>) => {
      await applyLegacyConfigHook(config, options);
    },
  };
}

/**
 * OpenCode v2 `setup(ctx)` implementation.
 */
export async function setupNineRouterPlugin(
  ctx: OpenCodeV2PluginContext,
): Promise<(() => void) | void> {
  const timeoutMs = typeof ctx.options?.timeoutMs === "number" ? ctx.options.timeoutMs : 8000;
  const stateByProvider = new Map<string, ProviderRuntimeEntry>();

  const refreshDiscoveredModels = async (): Promise<boolean> => {
    const discoveredProviders = discover9RouterProviders({
      directory: ctx.location?.directory,
      extraConfigObjects: ctx.options ? [ctx.options] : undefined,
    });

    let changed = false;

    for (const [providerId, providerConfig] of discoveredProviders.entries()) {
      if (!is9RouterProvider(providerId)) {
        continue;
      }

      const baseURL = providerConfig.baseURL;
      if (!baseURL || typeof baseURL !== "string" || !baseURL.trim()) {
        continue;
      }

      const apiKey = await resolveProviderApiKey(ctx, providerConfig);

      try {
        const rawModels = await fetch9RouterModels({
          baseURL,
          apiKey,
          timeoutMs,
        });

        const chatModels = rawModels.filter((model) => isChatModel(model));
        stateByProvider.set(providerId, {
          providerConfig,
          models: chatModels,
        });
        changed = true;
      } catch (err) {
        console.warn(
          `[9router-loader] Failed to fetch models for provider "${providerId}":`,
          err instanceof Error ? err.message : String(err),
        );
        const existing = stateByProvider.get(providerId);
        if (existing) {
          stateByProvider.set(providerId, {
            providerConfig,
            models: existing.models,
          });
        }
      }
    }

    return changed;
  };

  // Fetch models during setup so initial provider/model snapshots include them immediately
  await refreshDiscoveredModels();

  await ctx.provider.transform((providers) => {
    for (const [providerId, entry] of stateByProvider.entries()) {
      if (!is9RouterProvider(providerId)) {
        continue;
      }

      const existingRecord = providers.get(providerId);
      const preExistingModels = new Map<string, Record<string, any>>();
      if (existingRecord?.models instanceof Map) {
        for (const [modelId, modelVal] of existingRecord.models.entries()) {
          if (modelVal && typeof modelVal === "object") {
            preExistingModels.set(modelId, structuredClone(modelVal));
          }
        }
      }

      providers.update(providerId, (provider) => {
        provider.id = providerId;
        provider.activation = "enabled";
        if (!provider.name) {
          provider.name = entry.providerConfig.name || providerId;
        }
        if (!provider.package) {
          provider.package = entry.providerConfig.package || DEFAULT_PROVIDER_PACKAGE;
        }
        if (entry.providerConfig.settings) {
          provider.settings = {
            ...entry.providerConfig.settings,
            ...(provider.settings && typeof provider.settings === "object"
              ? provider.settings
              : {}),
          };
        }
        if (entry.providerConfig.headers) {
          provider.headers = {
            ...entry.providerConfig.headers,
            ...(provider.headers && typeof provider.headers === "object"
              ? provider.headers
              : {}),
          };
        }
        if (entry.providerConfig.body) {
          provider.body = {
            ...entry.providerConfig.body,
            ...(provider.body && typeof provider.body === "object" ? provider.body : {}),
          };
        }
      });

      const discoveredIds = new Set<string>();
      for (const rawModel of entry.models) {
        discoveredIds.add(rawModel.id);
        const configOverride = entry.providerConfig.models[rawModel.id];
        const preExisting = preExistingModels.get(rawModel.id);
        const combinedOverride =
          preExisting || configOverride
            ? { ...(preExisting ?? {}), ...(configOverride ?? {}) }
            : undefined;

        providers.models.update(providerId, rawModel.id, (draft) => {
          apply9RouterModelToV2Draft(draft, providerId, rawModel, combinedOverride);
        });
      }

      // Preserve any custom user-configured models that were not in the upstream /v1/models list
      for (const [customId, userModelCfg] of Object.entries(entry.providerConfig.models)) {
        if (discoveredIds.has(customId)) {
          continue;
        }
        providers.models.update(providerId, customId, (draft) => {
          applyUserModelOverrideToV2Draft(draft, providerId, customId, userModelCfg);
        });
      }
    }
  });

  if (typeof ctx.model?.transform === "function") {
    await ctx.model.transform((models) => {
      for (const [providerId, entry] of stateByProvider.entries()) {
        if (!is9RouterProvider(providerId)) {
          continue;
        }
        for (const rawModel of entry.models) {
          const userOverride = entry.providerConfig.models[rawModel.id];
          const current = models.get(providerId, rawModel.id);
          if (!current) {
            models.update(providerId, rawModel.id, (draft) => {
              apply9RouterModelToV2Draft(draft, providerId, rawModel, userOverride);
            });
          } else if (userOverride) {
            models.update(providerId, rawModel.id, (draft) => {
              applyUserModelOverrideToV2Draft(draft, providerId, rawModel.id, userOverride);
            });
          }
        }
      }
    });
  }

  if (typeof ctx.event?.subscribe === "function") {
    const controller = new AbortController();
    void (async () => {
      try {
        for await (const event of ctx.event!.subscribe!({ signal: controller.signal })) {
          if (event?.type === "config.updated") {
            const updated = await refreshDiscoveredModels();
            if (updated) {
              await ctx.provider.reload?.();
              await ctx.model?.reload?.();
            }
          }
        }
      } catch {
        // Subscription ended or aborted
      }
    })();

    return () => {
      controller.abort();
    };
  }
}

export const NineRouterLoaderPlugin = {
  id: PLUGIN_ID,
  setup: setupNineRouterPlugin,
  config: applyLegacyConfigHook,
};

export default NineRouterLoaderPlugin;
