import type { NineRouterModel, OpenCodeModelConfig } from "./types.js";

/**
 * Maps a 9Router model definition to OpenCode's ModelConfig.
 * Per specification:
 * 1. Model name MUST exactly match its model ID.
 * 2. Capabilities (tools, reasoning, attachment, limits, modalities) are mapped.
 */
export function map9RouterModelToOpenCode(model: NineRouterModel): OpenCodeModelConfig {
  const caps = model.capabilities ?? {};

  const contextLimit = caps.contextWindow ?? model.context_length ?? 128000;
  const outputLimit = caps.maxOutput ?? model.max_completion_tokens ?? 4096;

  // Modalities input & output
  const inputModalities: Array<"text" | "image" | "pdf" | "audio" | "video"> = ["text"];
  if (caps.vision) inputModalities.push("image");
  if (caps.pdf) inputModalities.push("pdf");
  if (caps.audioInput) inputModalities.push("audio");
  if (caps.videoInput) inputModalities.push("video");

  const outputModalities: Array<"text" | "image" | "pdf" | "audio" | "video"> = ["text"];
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
