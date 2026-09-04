import { describe, it, expect, afterEach } from "vitest";
import { ModelCache } from "../src/cache.js";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

describe("cache - ModelCache", () => {
  const tempPath = path.join(os.tmpdir(), `test-cache-${Date.now()}.json`);

  afterEach(async () => {
    await fs.unlink(tempPath).catch(() => {
      // cache file may not exist for a given test
    });
  });

  it("writes and reads cached models when fresh", async () => {
    const cache = new ModelCache(10000, tempPath);
    expect(await cache.read()).toBeNull();

    await cache.write({
      "test/model": {
        name: "test/model",
      },
    });

    const cached = await cache.read();
    expect(cached).toBeDefined();
    expect(cached?.["test/model"]?.name).toBe("test/model");
  });

  it("returns null when cache is expired", async () => {
    const cache = new ModelCache(50, tempPath);
    await cache.write({
      "test/model": {
        name: "test/model",
      },
    });

    // Wait for expiration
    await new Promise((res) => setTimeout(res, 60));

    expect(await cache.read()).toBeNull();
  });
});
