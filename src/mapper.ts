import type {
  NineRouterModel,
  OpenCodeModality,
  OpenCodeModelConfig,
  OpenCodeV2ModelInfo,
  OpenCodeV2Variant,
} from "./types.js";

const DEFAULT_REASONING_EFFORTS = ["low", "medium", "high"] as const;

export function buildReasoningVariants(supportsReasoning: boolean): OpenCodeV2Variant[] {
  if (!supportsReasoning) {
    return [];
  }
  return DEFAULT_REASONING_EFFORTS.map((effort) => ({
    id: effort,
    settings: {
      reasoningEffort: effort,
    },
  }));
}

/**
 * Maps a 9Router model definition to OpenCode's V1 ModelConfig.
 * Per specification:
 * 1. Model name MUST exactly match its model ID.
 * 2. Capabilities (tools, reasoning, attachment, limits, modalities) are mapped.
 */
export function map9RouterModelToOpenCode(model: NineRouterModel): OpenCodeModelConfig {
  const caps = model.capabilities ?? {};

  const contextLimit = caps.contextWindow ?? model.context_length ?? 128000;
  const outputLimit = caps.maxOutput ?? model.max_completion_tokens ?? 4096;

  // Modalities input & output
  const inputModalities: OpenCodeModality[] = ["text"];
  if (caps.vision) inputModalities.push("image");
  if (caps.pdf) inputModalities.push("pdf");
  if (caps.audioInput) inputModalities.push("audio");
  if (caps.videoInput) inputModalities.push("video");

  const outputModalities: OpenCodeModality[] = ["text"];
  if (caps.imageOutput) outputModalities.push("image");
  if (caps.audioOutput) outputModalities.push("audio");

  const config: OpenCodeModelConfig = {
    name: model.id,
    tool_call: Boolean(caps.tools),
    attachment: Boolean(caps.vision),
    reasoning: Boolean(caps.reasoning),
    limit: {
      context: contextLimit,
      output: outputLimit,
    },
    modalities: {
      input: inputModalities,
      output: outputModalities,
    },
  };

  return config;
}

/**
 * Maps a 9Router model definition to OpenCode v2's Model.Info structure.
 */
export function map9RouterModelToV2(
  model: NineRouterModel,
  providerID: string,
): OpenCodeV2ModelInfo {
  const v1 = map9RouterModelToOpenCode(model);
  const input = v1.modalities?.input ?? ["text"];
  const output = v1.modalities?.output ?? ["text"];

  return {
    id: model.id,
    modelID: model.id,
    providerID,
    name: model.id,
    status: "active",
    enabled: true,
    cost: [],
    limit: {
      context: v1.limit?.context ?? 128000,
      output: v1.limit?.output ?? 4096,
    },
    capabilities: {
      tools: Boolean(v1.tool_call),
      input: [...input],
      output: [...output],
    },
    time: {
      released: 0,
    },
    variants: buildReasoningVariants(Boolean(v1.reasoning)),
  };
}

/**
 * Applies user model overrides (Supporting both V1 and V2 config shapes) onto a V2 model draft.
 */
export function applyUserModelOverrideToV2Draft(
  draft: Record<string, any>,
  providerID: string,
  modelID: string,
  userOverride: Record<string, any>,
): void {
  draft.id = modelID;
  draft.providerID = providerID;
  draft.modelID =
    typeof userOverride.modelID === "string" && userOverride.modelID
      ? userOverride.modelID
      : draft.modelID ?? modelID;

  if (typeof userOverride.name === "string" && userOverride.name) {
    draft.name = userOverride.name;
  } else if (!draft.name) {
    draft.name = modelID;
  }

  if (typeof userOverride.family === "string") {
    draft.family = userOverride.family;
  }

  if (typeof userOverride.disabled === "boolean") {
    draft.enabled = !userOverride.disabled;
  } else if (draft.enabled === undefined) {
    draft.enabled = true;
  }

  if (!draft.status) {
    draft.status = "active";
  }

  if (userOverride.limit && typeof userOverride.limit === "object") {
    draft.limit = {
      ...(draft.limit ?? { context: 128000, output: 4096 }),
      ...userOverride.limit,
    };
  }

  // Merge capabilities from either V2 `capabilities` or V1 `tool_call`/`modalities`/`reasoning`
  const baseCaps = draft.capabilities ?? {
    tools: true,
    input: ["text"],
    output: ["text"],
  };
  const nextCaps = {
    ...baseCaps,
    input: [...(baseCaps.input ?? ["text"])],
    output: [...(baseCaps.output ?? ["text"])],
  };

  if (typeof userOverride.tool_call === "boolean") {
    nextCaps.tools = userOverride.tool_call;
  }
  if (userOverride.modalities && typeof userOverride.modalities === "object") {
    if (Array.isArray(userOverride.modalities.input)) {
      nextCaps.input = [...userOverride.modalities.input];
    }
    if (Array.isArray(userOverride.modalities.output)) {
      nextCaps.output = [...userOverride.modalities.output];
    }
  }
  if (userOverride.capabilities && typeof userOverride.capabilities === "object") {
    if (typeof userOverride.capabilities.tools === "boolean") {
      nextCaps.tools = userOverride.capabilities.tools;
    }
    if (typeof userOverride.capabilities.temperature === "boolean") {
      nextCaps.temperature = userOverride.capabilities.temperature;
    }
    if (Array.isArray(userOverride.capabilities.input)) {
      nextCaps.input = [...userOverride.capabilities.input];
    }
    if (Array.isArray(userOverride.capabilities.output)) {
      nextCaps.output = [...userOverride.capabilities.output];
    }
  }
  draft.capabilities = nextCaps;

  if (typeof userOverride.reasoning === "boolean") {
    draft.variants = buildReasoningVariants(userOverride.reasoning);
  } else if (
    userOverride.capabilities?.reasoning &&
    typeof userOverride.capabilities.reasoning === "object" &&
    typeof userOverride.capabilities.reasoning.supported === "boolean"
  ) {
    draft.variants = buildReasoningVariants(userOverride.capabilities.reasoning.supported);
  }

  if (Array.isArray(userOverride.variants)) {
    draft.variants = [...userOverride.variants];
  }

  if (typeof userOverride.package === "string") {
    draft.package = userOverride.package;
  }
  if (userOverride.settings && typeof userOverride.settings === "object") {
    draft.settings = { ...(draft.settings ?? {}), ...userOverride.settings };
  }
  if (userOverride.options && typeof userOverride.options === "object") {
    draft.settings = { ...(draft.settings ?? {}), ...userOverride.options };
  }
  if (userOverride.headers && typeof userOverride.headers === "object") {
    draft.headers = { ...(draft.headers ?? {}), ...userOverride.headers };
  }
  if (userOverride.body && typeof userOverride.body === "object") {
    draft.body = { ...(draft.body ?? {}), ...userOverride.body };
  }
}

/**
 * Mutates an OpenCode v2 Model.Info draft with mapped 9Router metadata and optional user overrides.
 */
export function apply9RouterModelToV2Draft(
  draft: Record<string, any>,
  providerID: string,
  model: NineRouterModel,
  userOverride?: Record<string, any>,
): void {
  const mapped = map9RouterModelToV2(model, providerID);

  draft.id = mapped.id;
  draft.modelID = mapped.modelID;
  draft.providerID = mapped.providerID;
  draft.name = mapped.name;
  draft.status = mapped.status;
  draft.enabled = mapped.enabled;
  draft.cost = draft.cost ?? mapped.cost;
  draft.limit = { ...mapped.limit };
  draft.capabilities = {
    tools: mapped.capabilities.tools,
    input: [...mapped.capabilities.input],
    output: [...mapped.capabilities.output],
  };
  draft.time = draft.time ?? { ...mapped.time };
  draft.variants = mapped.variants.map((v) => ({
    ...v,
    settings: v.settings ? { ...v.settings } : undefined,
  }));

  if (userOverride && typeof userOverride === "object") {
    applyUserModelOverrideToV2Draft(draft, providerID, model.id, userOverride);
  }
}
