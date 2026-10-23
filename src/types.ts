export type OpenCodeModality = "text" | "audio" | "image" | "video" | "pdf";

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
  input: OpenCodeModality[];
  output: OpenCodeModality[];
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
  package?: string;
  name?: string;
  api?: string;
  baseURL?: string;
  apiKey?: string;
  options?: {
    baseURL?: string;
    apiKey?: string;
    headers?: Record<string, string>;
    [key: string]: unknown;
  };
  settings?: {
    baseURL?: string;
    apiKey?: string;
    headers?: Record<string, string>;
    [key: string]: unknown;
  };
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  models?: Record<string, Record<string, any>>;
  [key: string]: unknown;
}

export interface OpenCodeV2Capabilities {
  tools: boolean;
  temperature?: boolean;
  input: OpenCodeModality[];
  output: OpenCodeModality[];
}

export interface OpenCodeV2Variant {
  id: string;
  settings?: Record<string, unknown>;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
}

export interface OpenCodeV2ModelInfo {
  id: string;
  modelID: string;
  providerID: string;
  canonical?: string;
  name: string;
  family?: string;
  status: "alpha" | "beta" | "deprecated" | "active";
  enabled: boolean;
  cost: Array<{
    tier?: { min: number; max?: number };
    input: number;
    output: number;
    cache: { read: number; write: number };
  }>;
  limit: OpenCodeModelLimit;
  capabilities: OpenCodeV2Capabilities;
  time: { released: number };
  variants: OpenCodeV2Variant[];
  package?: string;
  compatibility?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
}

export interface DiscoveredNineRouterProvider {
  id: string;
  name?: string;
  package: string;
  baseURL?: string;
  apiKey?: string;
  settings?: Record<string, unknown>;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  models: Record<string, Record<string, any>>;
}

export interface OpenCodeV2ProviderEditor {
  list: () => Array<{
    provider: Record<string, any>;
    models: Map<string, Record<string, any>>;
  }>;
  get: (id: string) =>
    | {
        provider: Record<string, any>;
        models: Map<string, Record<string, any>>;
      }
    | undefined;
  add?: (definition: Record<string, any>) => void;
  update: (id: string, update: (provider: Record<string, any>) => void) => void;
  remove?: (id: string) => void;
  models: {
    set?: (id: string, models: Record<string, any>[]) => void;
    update: (
      providerID: string,
      modelID: string,
      update: (model: Record<string, any>) => void,
    ) => void;
    remove?: (providerID: string, modelID: string) => void;
  };
}

export interface OpenCodeV2ModelEditor {
  list: (providerID?: string) => Array<Record<string, any>>;
  get: (providerID: string, modelID: string) => Record<string, any> | undefined;
  update: (
    providerID: string,
    modelID: string,
    update: (model: Record<string, any>) => void,
  ) => void;
  remove?: (providerID: string, modelID: string) => void;
  default?: {
    get: () => { providerID: string; modelID: string } | undefined;
    set: (providerID: string, modelID: string) => void;
  };
  provider?: {
    list: () => Array<{
      provider: Record<string, any>;
      models: Map<string, Record<string, any>>;
    }>;
    get: (id: string) =>
      | {
          provider: Record<string, any>;
          models: Map<string, Record<string, any>>;
        }
      | undefined;
  };
}

export interface OpenCodeV2PluginContext {
  location?: {
    directory?: string;
    workspaceID?: string;
    project?: Record<string, unknown>;
  };
  options?: Record<string, unknown>;
  provider: {
    list?: () => Promise<{ data?: Array<Record<string, any>> } | Array<Record<string, any>>>;
    get?: (input: { providerID: string }) => Promise<{ data?: Record<string, any> } | Record<string, any>>;
    reload?: () => Promise<void>;
    transform: (callback: (providers: OpenCodeV2ProviderEditor) => void) => Promise<void> | void;
  };
  model?: {
    list?: () => Promise<{ data?: Array<Record<string, any>> } | Array<Record<string, any>>>;
    reload?: () => Promise<void>;
    transform: (callback: (models: OpenCodeV2ModelEditor) => void) => Promise<void> | void;
  };
  integration?: {
    connection?: {
      active?: (id: string) => Promise<Record<string, any> | undefined>;
      resolve?: (connection: Record<string, any>) => Promise<Record<string, any> | undefined>;
    };
  };
  event?: {
    subscribe?: (options?: { signal?: AbortSignal }) => AsyncIterable<{ type: string; [key: string]: unknown }>;
  };
}
