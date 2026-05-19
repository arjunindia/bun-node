import { describe, it, expect } from "vitest";

describe("bun package imports", () => {
  it("resolves 'bun' main entry", async () => {
    const mod = await import("bun");
    expect(mod).toBeDefined();
  });

  it("resolves 'bun/sqlite' subpath", async () => {
    const mod = await import("bun/sqlite");
    expect(mod).toBeDefined();
  });

  it("resolves 'bun/ffi' subpath", async () => {
    const mod = await import("bun/ffi");
    expect(mod).toBeDefined();
  });

  it("resolves 'bun/test' subpath", async () => {
    const mod = await import("bun/test");
    expect(mod).toBeDefined();
  });

  it("resolves 'bun/jsc' subpath", async () => {
    const mod = await import("bun/jsc");
    expect(mod).toBeDefined();
  });
});
