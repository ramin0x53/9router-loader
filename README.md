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
- **Fast Startup (Local Caching)**: Caches discovered models at `~/.cache/opencode/9router-cache.json` with a 1-hour TTL for zero startup latency.

---

## Installation & Configuration

### 1. Build the Plugin

If working from source:

```bash
npm install
npm run build
```

### 2. Configure `opencode.json`

Add the plugin path to your OpenCode configuration (typically `~/.config/opencode/opencode.json` or project-level `opencode.json`):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "/Users/dexter/Code/9router-loader"
  ],
  "provider": {
    "9router": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "9Router",
      "options": {
        "baseURL": "https://your-9router-endpoint.com/v1",
        "apiKey": "sk-your-9router-api-key"
      }
    }
  }
}
```

> **Note**: The provider key **must** start with `9router` (case-insensitive).

---

## Usage

List all available 9Router models:

```bash
opencode models 9router
```

Run an OpenCode session with any 9Router model:

```bash
opencode run --model 9router/ag/gemini-3.8-flash-high "Explain the architecture of this repo"
```

Or select the model interactively inside the OpenCode TUI using the model picker (`/model` or via keyboard navigation).

---

## Customizing Specific Models (Overrides)

If you want to customize limits or parameters for a specific model, define it under `provider.9router.models` in your `opencode.json`. The plugin will preserve your custom settings over the auto-discovered ones:

```json
{
  "provider": {
    "9router": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "9Router",
      "options": {
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

## Cache Management

The plugin caches model responses to avoid network requests on every command:

- **Cache location**: `~/.cache/opencode/9router-cache.json`
- **Default TTL**: 1 hour

To force a refresh:

```bash
rm ~/.cache/opencode/9router-cache.json
opencode models 9router
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
src/
  index.ts      Plugin entry point (exports the OpenCode plugin)
  plugin.ts     config hook: detection, discovery, merge
  detector.ts   Strict `9router*` provider ID matching
  client.ts     /v1/models fetch with timeout + bearer auth
  mapper.ts     9Router capabilities -> OpenCode model config
  filter.ts     Non-chat model filtering (ASR, embeddings, rerankers)
  cache.ts      Disk cache with TTL
  types.ts      9Router API + OpenCode config types
tests/          Vitest unit tests
```

## License

MIT — see [LICENSE](./LICENSE).
