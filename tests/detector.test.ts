import { describe, it, expect } from "vitest";
import { is9RouterProvider } from "../src/detector.js";

describe("detector - is9RouterProvider", () => {
  it("returns true for '9router'", () => {
    expect(is9RouterProvider("9router")).toBe(true);
  });

  it("returns true for case-insensitive matches starting with 9router", () => {
    expect(is9RouterProvider("9Router")).toBe(true);
    expect(is9RouterProvider("9ROUTER-dev")).toBe(true);
    expect(is9RouterProvider("9router_staging")).toBe(true);
    expect(is9RouterProvider("  9router  ")).toBe(true);
  });

  it("returns false for providers that do not start with 9router", () => {
    expect(is9RouterProvider("openai")).toBe(false);
    expect(is9RouterProvider("anthropic")).toBe(false);
    expect(is9RouterProvider("my-9router")).toBe(false);
    expect(is9RouterProvider("router9")).toBe(false);
    expect(is9RouterProvider("")).toBe(false);
    expect(is9RouterProvider(null as unknown as string)).toBe(false);
  });
});
