import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { OpenCodeModelConfig } from "./types.js";

export interface CacheEntry {
  timestamp: number;
  models: Record<string, OpenCodeModelConfig>;
}

export class ModelCache {
  private cacheFilePath: string;
  private ttlMs: number;

  constructor(ttlMs: number = 60 * 60 * 1000, customPath?: string) {
    this.ttlMs = ttlMs;
    if (customPath) {
      this.cacheFilePath = customPath;
    } else {
      const home = os.homedir();
      this.cacheFilePath = path.join(home, ".cache", "opencode", "9router-cache.json");
    }
  }

  async read(): Promise<Record<string, OpenCodeModelConfig> | null> {
    try {
      const data = await fs.readFile(this.cacheFilePath, "utf-8");
      const parsed = JSON.parse(data) as CacheEntry;
      if (!parsed || typeof parsed.timestamp !== "number" || typeof parsed.models !== "object") {
        return null;
      }

      const isExpired = Date.now() - parsed.timestamp > this.ttlMs;
      if (isExpired) {
        return null;
      }

      return parsed.models;
    } catch {
      return null;
    }
  }

  async write(models: Record<string, OpenCodeModelConfig>): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.cacheFilePath), { recursive: true });
      const entry: CacheEntry = {
        timestamp: Date.now(),
        models,
      };
      await fs.writeFile(this.cacheFilePath, JSON.stringify(entry, null, 2), "utf-8");
    } catch {
      // Non-fatal cache write failure
    }
  }
}
