import { describe, it, expect } from "vitest";
import { pathToFileURL } from "node:url";
import { bun, BunFile } from "../index.js";

// --- Properties ---

describe("Bun properties", () => {
  it("Bun.version is a string", () => {
    expect(typeof bun.version).toBe("string");
  });

  it("Bun.revision is a string", () => {
    expect(typeof bun.revision).toBe("string");
  });

  it("Bun.env is process.env", () => {
    expect(bun.env).toBe(process.env);
  });

  it("Bun.main is a string", () => {
    expect(typeof bun.main).toBe("string");
  });

  it("Bun.argv is an array", () => {
    expect(Array.isArray(bun.argv)).toBe(true);
  });
});

// --- Timing ---

describe("Bun.sleep", () => {
  it("resolves after given milliseconds", async () => {
    const start = Date.now();
    await bun.sleep(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });

  it("resolves with a Date", async () => {
    const target = new Date(Date.now() + 50);
    await bun.sleep(target);
    expect(Date.now()).toBeGreaterThanOrEqual(target.getTime() - 10);
  });
});

describe("Bun.sleepSync", () => {
  it("blocks for the given duration", () => {
    const start = Date.now();
    bun.sleepSync(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });
});

describe("Bun.nanoseconds", () => {
  it("returns a bigint or number", () => {
    const ns = bun.nanoseconds();
    expect(typeof ns).toBe("number");
  });

  it("increases over time", async () => {
    const before = bun.nanoseconds();
    await bun.sleep(5);
    const after = bun.nanoseconds();
    expect(after).toBeGreaterThan(before);
  });
});

// --- UUID ---

describe("Bun.randomUUIDv7", () => {
  it("returns a string by default", () => {
    const id = bun.randomUUIDv7();
    expect(typeof id).toBe("string");
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("returns hex format", () => {
    const id = bun.randomUUIDv7("hex");
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("returns base64 format", () => {
    const id = bun.randomUUIDv7("base64");
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("returns base64url format", () => {
    const id = bun.randomUUIDv7("base64url");
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("returns buffer format", () => {
    const buf = bun.randomUUIDv7("buffer");
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBe(16);
  });

  it("accepts custom timestamp", () => {
    const ts = Date.now();
    const id = bun.randomUUIDv7("hex", ts);
    expect(typeof id).toBe("string");
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
  });

  it("generates monotonically increasing IDs", () => {
    const id1 = bun.randomUUIDv7("hex");
    const id2 = bun.randomUUIDv7("hex");
    const ts1 = parseInt(id1.split("-")[0], 16);
    const ts2 = parseInt(id2.split("-")[0], 16);
    expect(ts2).toBeGreaterThanOrEqual(ts1);
  });
});

// --- which ---

describe("Bun.which", () => {
  it("finds node executable", () => {
    const result = bun.which("node");
    expect(result).not.toBeNull();
    expect(result).toContain("node");
  });

  it("returns null for nonexistent executable", () => {
    const result = bun.which("definitely-not-a-real-command-12345");
    expect(result).toBeNull();
  });

  it("respects custom PATH", () => {
    const result = bun.which("node", { PATH: "/nonexistent" });
    expect(result).toBeNull();
  });
});

// --- peek ---

describe("Bun.peek", () => {
  it("is a function", () => {
    expect(typeof bun.peek).toBe("function");
  });

  it("peek.status is a function", () => {
    expect(typeof bun.peek.status).toBe("function");
  });

  it("returns the promise for pending promises", () => {
    const p = new Promise(() => {});
    const result = bun.peek(p);
    expect(result).toBe(p);
  });

  it("resolves with the value for settled promises", async () => {
    const p = Promise.resolve(42);
    const result = await bun.peek(p);
    expect(result).toBe(42);
  });
});

// --- deepEquals ---

describe("Bun.deepEquals", () => {
  it("compares primitives", () => {
    expect(bun.deepEquals(1, 1)).toBe(true);
    expect(bun.deepEquals(1, 2)).toBe(false);
    expect(bun.deepEquals("a", "a")).toBe(true);
    expect(bun.deepEquals(true, true)).toBe(true);
    expect(bun.deepEquals(null, null)).toBe(true);
    expect(bun.deepEquals(undefined, undefined)).toBe(true);
  });

  it("compares objects", () => {
    expect(bun.deepEquals({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    expect(bun.deepEquals({ a: 1 }, { a: 2 })).toBe(false);
  });

  it("compares arrays", () => {
    expect(bun.deepEquals([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(bun.deepEquals([1, 2], [1, 2, 3])).toBe(false);
  });

  it("compares nested structures", () => {
    const a = { x: [1, { y: 2 }] };
    const b = { x: [1, { y: 2 }] };
    expect(bun.deepEquals(a, b)).toBe(true);
  });

  it("handles dates", () => {
    expect(bun.deepEquals(new Date(1000), new Date(1000))).toBe(true);
    expect(bun.deepEquals(new Date(1000), new Date(2000))).toBe(false);
  });

  it("handles strict mode", () => {
    expect(bun.deepEquals({ a: 1 }, { a: 1, b: undefined }, false)).toBe(true);
    expect(bun.deepEquals({ a: 1 }, { a: 1, b: undefined }, true)).toBe(false);
  });

  it("handles regex", () => {
    expect(bun.deepEquals(/abc/gi, /abc/gi)).toBe(true);
    expect(bun.deepEquals(/abc/g, /abc/i)).toBe(false);
  });
});

// --- inspect ---

describe("Bun.inspect", () => {
  it("returns a string for objects", () => {
    const result = bun.inspect({ a: 1 });
    expect(typeof result).toBe("string");
    expect(result).toContain("a");
  });

  it("returns a string for arrays", () => {
    const result = bun.inspect([1, 2, 3]);
    expect(typeof result).toBe("string");
  });

  it("handles primitives", () => {
    expect(bun.inspect(42)).toBe("42");
    expect(bun.inspect("hello")).toBe("'hello'");
  });

  it("inspect.custom is a symbol", () => {
    expect(typeof bun.inspect.custom).toBe("symbol");
  });

  it("inspect.table returns a string", () => {
    const data = [
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ];
    const result = bun.inspect.table(data);
    expect(typeof result).toBe("string");
    expect(result).toContain("name");
    expect(result).toContain("Alice");
  });
});

// --- escapeHTML ---

describe("Bun.escapeHTML", () => {
  it("escapes HTML entities", () => {
    expect(bun.escapeHTML('<script>alert("xss")</script>')).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;"
    );
  });

  it("escapes ampersands", () => {
    expect(bun.escapeHTML("a & b")).toBe("a &amp; b");
  });

  it("escapes single quotes", () => {
    expect(bun.escapeHTML("it's")).toBe("it&#x27;s");
  });

  it("escapes backticks", () => {
    expect(bun.escapeHTML("`code`")).toBe("&#96;code&#96;");
  });

  it("handles non-string input", () => {
    expect(bun.escapeHTML(123)).toBe("123");
  });
});

// --- stringWidth ---

describe("Bun.stringWidth", () => {
  it("returns width of ASCII string", () => {
    expect(bun.stringWidth("hello")).toBe(5);
  });

  it("returns 0 for empty string", () => {
    expect(bun.stringWidth("")).toBe(0);
  });

  it("ignores ANSI escape codes by default", () => {
    expect(bun.stringWidth("\u001b[31mhello\u001b[0m")).toBe(5);
  });

  it("counts ANSI codes when option set", () => {
    const width = bun.stringWidth("\u001b[31mhello\u001b[0m", {
      countAnsiEscapeCodes: true,
    });
    expect(width).toBeGreaterThan(5);
  });
});

// --- stripANSI ---

describe("Bun.stripANSI", () => {
  it("removes ANSI escape codes", () => {
    expect(bun.stripANSI("\u001b[31mhello\u001b[0m")).toBe("hello");
  });

  it("handles string without ANSI", () => {
    expect(bun.stripANSI("hello")).toBe("hello");
  });

  it("handles multiple ANSI codes", () => {
    expect(bun.stripANSI("\u001b[1m\u001b[31mhi\u001b[0m")).toBe("hi");
  });
});

// --- URL conversion ---

describe("Bun.fileURLToPath / Bun.pathToFileURL", () => {
  it("converts file URL to path", () => {
    const url = pathToFileURL("/tmp/test.txt");
    const p = bun.fileURLToPath(url);
    expect(typeof p).toBe("string");
    expect(p).toContain("test.txt");
  });

  it("converts path to file URL", () => {
    const url = bun.pathToFileURL("/tmp/test.txt");
    expect(url).toBeInstanceOf(URL);
    expect(url.protocol).toBe("file:");
  });
});

// --- Compression ---

describe("Bun.gzipSync / Bun.gunzipSync", () => {
  it("compresses and decompresses", () => {
    const original = Buffer.from("hello world".repeat(100));
    const compressed = bun.gzipSync(original);
    expect(compressed.length).toBeLessThan(original.length);
    const decompressed = bun.gunzipSync(compressed);
    expect(decompressed.toString()).toBe(original.toString());
  });

  it("accepts ArrayBuffer", () => {
    const ab = new ArrayBuffer(10);
    new Uint8Array(ab).fill(42);
    const compressed = bun.gzipSync(ab);
    expect(compressed.length).toBeGreaterThan(0);
  });
});

describe("Bun.deflateSync / Bun.inflateSync", () => {
  it("compresses and decompresses", () => {
    const original = Buffer.from("hello world".repeat(100));
    const compressed = bun.deflateSync(original);
    expect(compressed.length).toBeLessThan(original.length);
    const decompressed = bun.inflateSync(compressed);
    expect(decompressed.toString()).toBe(original.toString());
  });
});

describe("Bun.gzip / Bun.gunzip (async)", () => {
  it("compresses and decompresses async", async () => {
    const original = Buffer.from("async hello world");
    const compressed = await bun.gzip(original);
    const decompressed = await bun.gunzip(compressed);
    expect(decompressed.toString()).toBe(original.toString());
  });
});

// --- Stream consumption ---

describe("Bun.readableStreamTo*", () => {
  function makeStream(data) {
    return new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(data));
        controller.close();
      },
    });
  }

  it("readableStreamToText", async () => {
    const result = await bun.readableStreamToText(makeStream("hello"));
    expect(result).toBe("hello");
  });

  it("readableStreamToArrayBuffer", async () => {
    const ab = await bun.readableStreamToArrayBuffer(makeStream("abc"));
    expect(ab).toBeInstanceOf(ArrayBuffer);
    expect(new TextDecoder().decode(ab)).toBe("abc");
  });

  it("readableStreamToBytes", async () => {
    const bytes = await bun.readableStreamToBytes(makeStream("abc"));
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(bytes)).toBe("abc");
  });

  it("readableStreamToJSON", async () => {
    const obj = await bun.readableStreamToJSON(makeStream('{"a":1}'));
    expect(obj).toEqual({ a: 1 });
  });

  it("readableStreamToBlob", async () => {
    const blob = await bun.readableStreamToBlob(makeStream("blob data"));
    expect(blob).toBeInstanceOf(Blob);
    expect(await blob.text()).toBe("blob data");
  });

  it("readableStreamToArray", async () => {
    const arr = await bun.readableStreamToArray(makeStream("abc"));
    expect(arr.length).toBe(1);
  });
});

// --- resolveSync ---

describe("Bun.resolveSync", () => {
  it("resolves node built-in modules", () => {
    const resolved = bun.resolveSync("node:path", import.meta.url);
    expect(resolved).toContain("path");
  });

  it("resolves npm packages", () => {
    const resolved = bun.resolveSync("vitest", import.meta.url);
    expect(resolved).toContain("vitest");
  });
});

// --- Memory utilities ---

describe("Bun.allocUnsafe", () => {
  it("returns a Buffer of given size", () => {
    const buf = bun.allocUnsafe(1024);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBe(1024);
  });
});

describe("Bun.concatArrayBuffers", () => {
  it("concatenates ArrayBuffers", () => {
    const a = new Uint8Array([1, 2, 3]).buffer;
    const b = new Uint8Array([4, 5, 6]).buffer;
    const result = bun.concatArrayBuffers([a, b]);
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect([...new Uint8Array(result)]).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("handles TypedArrays", () => {
    const a = new Uint8Array([1, 2]);
    const b = new Uint8Array([3, 4]);
    const result = bun.concatArrayBuffers([a, b]);
    expect([...new Uint8Array(result)]).toEqual([1, 2, 3, 4]);
  });
});

describe("Bun.indexOfLine", () => {
  it("finds newline index", () => {
    const buf = Buffer.from("hello\nworld");
    expect(bun.indexOfLine(buf)).toBe(5);
  });

  it("finds newline with offset", () => {
    const buf = Buffer.from("hello\nworld\n");
    expect(bun.indexOfLine(buf, 6)).toBe(11);
  });

  it("returns -1 if no newline", () => {
    const buf = Buffer.from("hello");
    expect(bun.indexOfLine(buf)).toBe(-1);
  });
});

describe("Bun.gc", () => {
  it("does not throw", () => {
    expect(() => bun.gc()).not.toThrow();
  });

  it("accepts runSweep option", () => {
    expect(() => bun.gc({ runSweep: true })).not.toThrow();
  });
});
