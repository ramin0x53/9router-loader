import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { is9RouterProvider } from "./detector.js";
import type { DiscoveredNineRouterProvider, OpenCodeProviderConfig } from "./types.js";

const CONFIG_FILENAMES = ["opencode.json", "opencode.jsonc"] as const;
const DEFAULT_PROVIDER_PACKAGE = "@opencode/ai/providers/openai-compatible";

/**
 * Strips single-line (//) and multi-line (/* *\/) comments and trailing commas from JSONC text
 * while preserving everything inside string literals (such as "http://...").
 */
export function parseJsonc(text: string): Record<string, any> | undefined {
  let withoutComments = "";
  let inString = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];

    if (inString) {
      withoutComments += ch;
      if (ch === "\\" && i + 1 < text.length) {
        withoutComments += text[i + 1];
        i += 2;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      i += 1;
      continue;
    }

    if (ch === '"') {
      inString = true;
      withoutComments += ch;
      i += 1;
      continue;
    }

    if (ch === "/" && next === "/") {
      i += 2;
      while (i < text.length && text[i] !== "\n") {
        i += 1;
      }
      continue;
    }

    if (ch === "/" && next === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) {
        i += 1;
      }
      i += 2;
      continue;
    }

    withoutComments += ch;
    i += 1;
  }

  // Remove trailing commas outside of strings
  let cleaned = "";
  inString = false;
  i = 0;
  while (i < withoutComments.length) {
    const ch = withoutComments[i];
    if (inString) {
      cleaned += ch;
      if (ch === "\\" && i + 1 < withoutComments.length) {
        cleaned += withoutComments[i + 1];
        i += 2;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      i += 1;
      continue;
    }

    if (ch === '"') {
      inString = true;
      cleaned += ch;
      i += 1;
      continue;
    }

    if (ch === ",") {
      let lookahead = i + 1;
      while (lookahead < withoutComments.length && /\s/.test(withoutComments[lookahead])) {
        lookahead += 1;
      }
      const nextToken = withoutComments[lookahead];
      if (nextToken === "}" || nextToken === "]") {
        i += 1;
        continue;
      }
    }

    cleaned += ch;
    i += 1;
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, any>;
    }
  } catch {
    // Ignore malformed JSONC
  }
  return undefined;
}

/**
 * Performs OpenCode-compatible `{env:VAR}` and `{file:path}` variable substitution.
 */
export function substituteConfigVariables(
  text: string,
  baseDir: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const withEnv = (escape: boolean) =>
    text.replace(/\{env:([^}]+)\}/g, (_, name: string) => {
      const value = env[name.trim()] ?? "";
      return escape ? JSON.stringify(value).slice(1, -1) : value;
    });

  const replaceFiles = (input: string) =>
    input.replace(/\{file:([^}]+)\}/g, (match, rawPath: string, offset: number) => {
      const lineStart = input.lastIndexOf("\n", offset - 1) + 1;
      const prefix = input.slice(lineStart, offset).trimStart();
      if (prefix.startsWith("//")) {
        return match;
      }
      const trimmed = rawPath.trim();
      const expanded = trimmed.startsWith("~/")
        ? path.join(os.homedir(), trimmed.slice(2))
        : trimmed;
      const resolved = path.isAbsolute(expanded)
        ? expanded
        : path.resolve(baseDir, expanded);
      try {
        const content = fs.readFileSync(resolved, "utf8").trim();
        return JSON.stringify(content).slice(1, -1);
      } catch {
        return "";
      }
    });

  const candidate = replaceFiles(withEnv(false));
  if (!text.includes("{env:") || parseJsonc(candidate) !== undefined) {
    return candidate;
  }
  return replaceFiles(withEnv(true));
}

function getSystemConfigDir(platform: NodeJS.Platform = process.platform, env: NodeJS.ProcessEnv = process.env): string {
  if (platform === "darwin") {
    return "/Library/Application Support/opencode";
  }
  if (platform === "win32") {
    return path.join(env.ProgramData || "C:\\ProgramData", "opencode");
  }
  return "/etc/opencode";
}

function getGlobalConfigDir(env: NodeJS.ProcessEnv = process.env): string {
  if (env.OPENCODE_CONFIG_DIR && env.OPENCODE_CONFIG_DIR.trim()) {
    return path.resolve(env.OPENCODE_CONFIG_DIR.trim());
  }
  const xdgConfig = env.XDG_CONFIG_HOME?.trim() || path.join(os.homedir(), ".config");
  return path.join(xdgConfig, "opencode");
}

function getAncestorDirectories(startDir: string): string[] {
  const dirs: string[] = [];
  let current = path.resolve(startDir);
  while (true) {
    dirs.push(current);
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return dirs.reverse();
}

function loadConfigFile(filePath: string, env: NodeJS.ProcessEnv): Record<string, any> | undefined {
  try {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return undefined;
    }
    const raw = fs.readFileSync(filePath, "utf8");
    const substituted = substituteConfigVariables(raw, path.dirname(filePath), env);
    return parseJsonc(substituted);
  } catch {
    return undefined;
  }
}

function normalizePackageName(rawPackage?: string): string {
  if (!rawPackage || typeof rawPackage !== "string") {
    return DEFAULT_PROVIDER_PACKAGE;
  }
  const trimmed = rawPackage.trim();
  if (
    trimmed === "@ai-sdk/openai-compatible" ||
    trimmed === "aisdk:@ai-sdk/openai-compatible" ||
    trimmed === "@opencode-ai/ai/providers/openai-compatible"
  ) {
    return DEFAULT_PROVIDER_PACKAGE;
  }
  if (trimmed.startsWith("@opencode-ai/ai/")) {
    return trimmed.replace("@opencode-ai/ai/", "@opencode/ai/");
  }
  return trimmed;
}

/**
 * Extracts and merges a single 9Router provider configuration onto an existing accumulator.
 */
export function mergeNineRouterProviderConfig(
  id: string,
  rawConfig: OpenCodeProviderConfig,
  existing?: DiscoveredNineRouterProvider,
): DiscoveredNineRouterProvider {
  const base: DiscoveredNineRouterProvider = existing ?? {
    id,
    package: DEFAULT_PROVIDER_PACKAGE,
    models: {},
  };

  const rawSettings =
    rawConfig.settings && typeof rawConfig.settings === "object" ? rawConfig.settings : {};
  const rawOptions =
    rawConfig.options && typeof rawConfig.options === "object" ? rawConfig.options : {};

  const baseURLCandidate =
    rawSettings.baseURL ??
    rawOptions.baseURL ??
    rawConfig.baseURL ??
    rawConfig.api ??
    base.baseURL;

  const apiKeyCandidate =
    rawSettings.apiKey ??
    rawOptions.apiKey ??
    rawConfig.apiKey ??
    base.apiKey;

  const rawPkg = rawConfig.package ?? rawConfig.npm;
  const pkg = rawPkg ? normalizePackageName(rawPkg) : base.package;

  const mergedSettings: Record<string, unknown> = {
    ...(base.settings ?? {}),
    ...rawOptions,
    ...rawSettings,
  };
  if (typeof baseURLCandidate === "string" && baseURLCandidate.trim()) {
    mergedSettings.baseURL = baseURLCandidate.trim();
  }
  if (typeof apiKeyCandidate === "string" && apiKeyCandidate.trim()) {
    mergedSettings.apiKey = apiKeyCandidate.trim();
  }

  const rawHeaders = {
    ...(rawOptions.headers && typeof rawOptions.headers === "object" ? rawOptions.headers : {}),
    ...(rawSettings.headers && typeof rawSettings.headers === "object" ? rawSettings.headers : {}),
    ...(rawConfig.headers && typeof rawConfig.headers === "object" ? rawConfig.headers : {}),
  };
  const mergedHeaders =
    Object.keys(rawHeaders).length > 0 || base.headers
      ? { ...(base.headers ?? {}), ...rawHeaders }
      : undefined;

  const mergedBody =
    rawConfig.body && typeof rawConfig.body === "object"
      ? { ...(base.body ?? {}), ...rawConfig.body }
      : base.body;

  const mergedModels: Record<string, Record<string, any>> = { ...base.models };
  if (rawConfig.models && typeof rawConfig.models === "object") {
    for (const [modelId, modelCfg] of Object.entries(rawConfig.models)) {
      if (modelCfg && typeof modelCfg === "object") {
        mergedModels[modelId] = {
          ...(mergedModels[modelId] ?? {}),
          ...modelCfg,
        };
      }
    }
  }

  return {
    id,
    name: typeof rawConfig.name === "string" && rawConfig.name ? rawConfig.name : base.name,
    package: pkg,
    baseURL: typeof baseURLCandidate === "string" ? baseURLCandidate.trim() : base.baseURL,
    apiKey: typeof apiKeyCandidate === "string" ? apiKeyCandidate.trim() : base.apiKey,
    settings: Object.keys(mergedSettings).length > 0 ? mergedSettings : undefined,
    headers: mergedHeaders,
    body: mergedBody,
    models: mergedModels,
  };
}

/**
 * Discovers all 9Router provider configurations across OpenCode config files and environment variables.
 */
export function discover9RouterProviders(options?: {
  directory?: string;
  env?: NodeJS.ProcessEnv;
  extraConfigObjects?: Array<Record<string, any>>;
}): Map<string, DiscoveredNineRouterProvider> {
  const env = options?.env ?? process.env;
  const startDir = options?.directory || process.cwd();
  const documents: Array<Record<string, any>> = [];

  const seenFiles = new Set<string>();
  const tryPushFile = (filePath: string) => {
    const resolved = path.resolve(filePath);
    if (seenFiles.has(resolved)) {
      return;
    }
    seenFiles.add(resolved);
    const doc = loadConfigFile(resolved, env);
    if (doc) {
      documents.push(doc);
    }
  };

  // 1. System config directory
  const systemDir = getSystemConfigDir(process.platform, env);
  for (const name of CONFIG_FILENAMES) {
    tryPushFile(path.join(systemDir, name));
  }

  // 2. Global config directory
  const globalDir = getGlobalConfigDir(env);
  for (const name of CONFIG_FILENAMES) {
    tryPushFile(path.join(globalDir, name));
  }

  // 3. Explicit OPENCODE_CONFIG file
  if (env.OPENCODE_CONFIG && env.OPENCODE_CONFIG.trim()) {
    tryPushFile(env.OPENCODE_CONFIG.trim());
  }

  // 4. Ancestor directories (root -> startDir): direct opencode.json(c) then .opencode/opencode.json(c)
  const ancestors = getAncestorDirectories(startDir);
  for (const dir of ancestors) {
    for (const name of CONFIG_FILENAMES) {
      tryPushFile(path.join(dir, name));
    }
  }
  for (const dir of ancestors) {
    for (const name of CONFIG_FILENAMES) {
      tryPushFile(path.join(dir, ".opencode", name));
    }
  }

  // 5. OPENCODE_CONFIG_CONTENT environment variable
  if (env.OPENCODE_CONFIG_CONTENT && env.OPENCODE_CONFIG_CONTENT.trim()) {
    const substituted = substituteConfigVariables(
      env.OPENCODE_CONFIG_CONTENT,
      startDir,
      env,
    );
    const parsed = parseJsonc(substituted);
    if (parsed) {
      documents.push(parsed);
    }
  }

  // 6. Any extra in-memory config objects (e.g. passed via plugin options or tests)
  if (Array.isArray(options?.extraConfigObjects)) {
    for (const extra of options.extraConfigObjects) {
      if (extra && typeof extra === "object") {
        documents.push(extra);
      }
    }
  }

  const providers = new Map<string, DiscoveredNineRouterProvider>();

  for (const doc of documents) {
    // Support both V1 `provider` and V2 `providers` keys
    const sections = [doc.provider, doc.providers];
    for (const section of sections) {
      if (!section || typeof section !== "object" || Array.isArray(section)) {
        continue;
      }
      for (const [providerId, rawVal] of Object.entries(section)) {
        if (!is9RouterProvider(providerId) || !rawVal || typeof rawVal !== "object") {
          continue;
        }
        const merged = mergeNineRouterProviderConfig(
          providerId,
          rawVal as OpenCodeProviderConfig,
          providers.get(providerId),
        );
        providers.set(providerId, merged);
      }
    }
  }

  return providers;
}
