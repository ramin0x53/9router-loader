export {
  PLUGIN_ID,
  NineRouterLoaderPlugin,
  NineRouterLoaderPlugin as default,
  setupNineRouterPlugin,
  applyLegacyConfigHook,
  createLegacy9RouterPlugin,
} from "./plugin.js";
export { is9RouterProvider } from "./detector.js";
export { isChatModel } from "./filter.js";
export {
  map9RouterModelToOpenCode,
  map9RouterModelToV2,
  apply9RouterModelToV2Draft,
  applyUserModelOverrideToV2Draft,
  buildReasoningVariants,
} from "./mapper.js";
export { fetch9RouterModels } from "./client.js";
export {
  discover9RouterProviders,
  mergeNineRouterProviderConfig,
  parseJsonc,
  substituteConfigVariables,
} from "./config.js";
export type * from "./types.js";
