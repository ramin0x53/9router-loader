export interface NineRouterCapabilities {
  vision?: boolean;
  pdf?: boolean;
  audioInput?: boolean;
  videoInput?: boolean;
  imageOutput?: boolean;
  audioOutput?: boolean;
  search?: boolean;
  tools?: boolean;
  reasoning?: boolean;
  thinkingFormat?: string | null;
  thinkingCanDisable?: boolean;
  thinkingEffortSupported?: boolean;
  thinkingRange?: unknown;
  contextWindow?: number;
  maxOutput?: number;
}

export interface NineRouterModel {
  id: string;
  object?: string;
  owned_by?: string;
  context_length?: number;
  max_completion_tokens?: number;
  capabilities?: NineRouterCapabilities;
}

export interface NineRouterModelsResponse {
  object?: string;
  data: NineRouterModel[];
}

export interface OpenCodeModelLimit {
  context: number;
  output: number;
  input?: number;
}

export interface OpenCodeModelModalities {
  input: Array<"text" | "audio" | "image" | "video" | "pdf">;
  output: Array<"text" | "audio" | "image" | "video" | "pdf">;
}

export interface OpenCodeModelConfig {
  name: string;
  tool_call?: boolean;
  attachment?: boolean;
  reasoning?: boolean;
  limit?: OpenCodeModelLimit;
  modalities?: OpenCodeModelModalities;
  [key: string]: unknown;
}

export interface OpenCodeProviderConfig {
  npm?: string;
  name?: string;
  api?: string;
  options?: {
    baseURL?: string;
    apiKey?: string;
    [key: string]: unknown;
  };
  models?: Record<string, OpenCodeModelConfig>;
  [key: string]: unknown;
}
