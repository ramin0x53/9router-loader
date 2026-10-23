# opencode-9router-loader

OpenCode plugin for dynamically discovering and loading models and capability metadata from **9Router**.

## Features

- **Strict Provider Matching**: Only targets providers whose ID starts with `9router` (e.g. `9router`, `9router-dev`, `9router_test`).
- **Exact Model Names**: Retains the exact upstream model ID as the display name (e.g. `ag/gemini-3.8-flash-high`, `kr/claude-opus-5`).
- **Capability Extraction**: Translates 9Router's metadata into OpenCode configuration:
  - Context & output token limits (`limit.context`, `limit.output`)
  - Tool calling support (`tool_call`)
  - Extended thinking / reasoning support (`reasoning`)
  - Vision / multimodal attachments (`attachment`, `modalities.input`, `modalities.output`)
- **Chat Filter**: Excludes non-chat models (such as ASR / speech-to-text models like `parakeet`, embeddings, and rerankers).
- **User Override Preservation**: Any model explicitly defined in your configuration takes precedence over discovered metadata.
- **Always Up-To-Date**: Fetches models dynamically from 9Router each time OpenCode starts up without using any disk cache.

---

## Installation & Configuration

### 1. Build the Plugin

If working from source:

```bash
npm install
npm run build
```

### 2. Configure `opencode.json` (OpenCode v2)

Add the plugin path (or package name) to your OpenCode v2 configuration (`~/.config/opencode/opencode.json` or project-level `opencode.json`):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    "/Users/dexter/Code/9router-loader"
  ],
  "providers": {
    "9router": {
      "package": "@opencode/ai/providers/openai-compatible",
      "name": "9Router",
      "settings": {
        "baseURL": "https://your-9router-endpoint.com/v1",
        "apiKey": "sk-your-9router-api-key"
      }
    }
  }
}
```

> **Note**: The provider key **must** start with `9router` (case-insensitive). Legacy OpenCode v1 keys (`"plugin"`, `"provider"`, `"npm": "@ai-sdk/openai-compatible"`, and `"options"`) are also supported.

---

## Usage

List all available models:

```bash
opencode models
```

Run an OpenCode session with any 9Router model:

```bash
opencode run --model 9router/ag/gemini-3.8-flash-high "Explain the architecture of this repo"
```

Or select the model interactively inside the OpenCode TUI using the model picker (`/model` or via keyboard navigation).

---

## Customizing Specific Models (Overrides)

If you want to customize limits or parameters for a specific model, define it under `providers.9router.models` in your `opencode.json`. The plugin will preserve your custom settings over the auto-discovered ones:

```json
{
  "providers": {
    "9router": {
      "package": "@opencode/ai/providers/openai-compatible",
      "name": "9Router",
      "settings": {
        "baseURL": "https://your-9router-endpoint.com/v1",
        "apiKey": "sk-..."
      },
      "models": {
        "ag/gemini-3.8-flash-high": {
          "limit": {
            "context": 500000,
            "output": 32000
          }
        }
      }
    }
  }
}
```

---

## Development & Testing

Install dependencies:

```bash
npm install
```

Available scripts:

| Script | Description |
| ------ | ----------- |
| `npm run build` | Bundle to `dist/` (ESM + type declarations) |
| `npm run dev` | Rebuild on file changes |
| `npm test` | Run the unit test suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run typecheck` | Type-check without emitting |
| `npm run lint` | Lint with ESLint |
| `npm run lint:fix` | Lint and auto-fix |
| `npm run check` | Lint + typecheck + tests |

## Project Structure

```
index.js        Root re-export for OpenCode v2 local directory plugin resolution
src/
  index.ts      Plugin entry point (exports the OpenCode v2 & v1 plugin)
  plugin.ts     OpenCode v2 setup(ctx) & v1 config hook implementation
  config.ts     OpenCode v2/v1 config file & env discovery (JSON/JSONC)
  detector.ts   Strict `9router*` provider ID matching
  client.ts     /v1/models fetch with timeout + bearer auth
  mapper.ts     9Router capabilities -> OpenCode v2 Model.Info & v1 ModelConfig
  filter.ts     Non-chat model filtering (ASR, embeddings, rerankers)
  types.ts      9Router API + OpenCode v2/v1 types
tests/          Vitest unit tests
```

## License

MIT — see [LICENSE](./LICENSE).
