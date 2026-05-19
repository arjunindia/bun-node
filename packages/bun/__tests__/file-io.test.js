import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { bun, BunFile, FileSink } from "../index.js";

let tmpDir;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "buniso-test-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

// --- Bun.file() ---

describe("Bun.file()", () => {
  it("creates a BunFile reference (lazy, no disk read)", () => {
    const foo = bun.file(path.join(tmpDir, "foo.txt"));
    expect(foo).toBeInstanceOf(BunFile);
  });

  it("returns size as 0 for nonexistent files", () => {
    const notreal = bun.file(path.join(tmpDir, "notreal.txt"));
    expect(notreal.size).toBe(0);
  });

  it("returns correct size for existing files", async () => {
    const filePath = path.join(tmpDir, "foo.txt");
    await fs.writeFile(filePath, "hello");
    const foo = bun.file(filePath);
    expect(foo.size).toBe(5);
  });

  it("returns default MIME type for unknown extensions", () => {
    const notreal = bun.file(path.join(tmpDir, "notreal.txt"));
    expect(notreal.type).toBe("text/plain;charset=utf-8");
  });

  it("allows MIME type override", () => {
    const notreal = bun.file(path.join(tmpDir, "notreal.json"), { type: "application/json" });
    expect(notreal.type).toBe("application/json;charset=utf-8");
  });

  it("detects MIME type from extension", () => {
    expect(bun.file("image.png").type).toBe("image/png");
    expect(bun.file("style.css").type).toBe("text/css;charset=utf-8");
    expect(bun.file("data.json").type).toBe("application/json;charset=utf-8");
  });

  it("exists() returns false for nonexistent files", async () => {
    const notreal = bun.file(path.join(tmpDir, "notreal.txt"));
    expect(await notreal.exists()).toBe(false);
  });

  it("exists() returns true for existing files", async () => {
    const filePath = path.join(tmpDir, "exists.txt");
    await fs.writeFile(filePath, "hi");
    const f = bun.file(filePath);
    expect(await f.exists()).toBe(true);
  });

  it("accepts a URL", async () => {
    const filePath = path.join(tmpDir, "url-test.txt");
    await fs.writeFile(filePath, "url content");
    const url = new URL(`file://${filePath.replace(/\\/g, "/")}`);
    const f = bun.file(url);
    expect(await f.text()).toBe("url content");
  });
});

// --- BunFile read methods ---

describe("BunFile read methods", () => {
  it("text() returns file contents as string", async () => {
    const filePath = path.join(tmpDir, "foo.txt");
    await fs.writeFile(filePath, "hello world");
    const foo = bun.file(filePath);
    expect(await foo.text()).toBe("hello world");
  });

  it("json() parses JSON content", async () => {
    const filePath = path.join(tmpDir, "data.json");
    const obj = { name: "bun", version: 1 };
    await fs.writeFile(filePath, JSON.stringify(obj));
    const f = bun.file(filePath);
    expect(await f.json()).toEqual(obj);
  });

  it("arrayBuffer() returns ArrayBuffer", async () => {
    const filePath = path.join(tmpDir, "buf.bin");
    await fs.writeFile(filePath, Buffer.from([1, 2, 3]));
    const f = bun.file(filePath);
    const ab = await f.arrayBuffer();
    expect(ab).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(ab)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("bytes() returns Uint8Array", async () => {
    const filePath = path.join(tmpDir, "bytes.bin");
    await fs.writeFile(filePath, Buffer.from([4, 5, 6]));
    const f = bun.file(filePath);
    const b = await f.bytes();
    expect(b).toBeInstanceOf(Uint8Array);
    expect(b).toEqual(new Uint8Array([4, 5, 6]));
  });

  it("stream() returns a ReadableStream", async () => {
    const filePath = path.join(tmpDir, "stream.txt");
    await fs.writeFile(filePath, "stream data");
    const f = bun.file(filePath);
    const stream = f.stream();
    expect(stream).toBeDefined();
    // Read from stream
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    const result = Buffer.concat(chunks).toString("utf-8");
    expect(result).toBe("stream data");
  });

  it("delete() removes the file", async () => {
    const filePath = path.join(tmpDir, "to-delete.txt");
    await fs.writeFile(filePath, "delete me");
    const f = bun.file(filePath);
    expect(await f.exists()).toBe(true);
    await f.delete();
    expect(await f.exists()).toBe(false);
  });

  it("delete() is a no-op for nonexistent files", async () => {
    const f = bun.file(path.join(tmpDir, "never-existed.txt"));
    await expect(f.delete()).resolves.not.toThrow();
  });
});

// --- Bun.write() ---

describe("Bun.write()", () => {
  it("writes a string to disk", async () => {
    const filePath = path.join(tmpDir, "output.txt");
    const data = "It was the best of times, it was the worst of times.";
    const bytes = await bun.write(filePath, data);
    expect(bytes).toBe(Buffer.byteLength(data));
    expect(await fs.readFile(filePath, "utf-8")).toBe(data);
  });

  it("copies a file via BunFile", async () => {
    const inputPath = path.join(tmpDir, "input.txt");
    const outputPath = path.join(tmpDir, "output.txt");
    await fs.writeFile(inputPath, "file content");
    const input = bun.file(inputPath);
    const output = bun.file(outputPath);
    const bytes = await bun.write(output, input);
    expect(bytes).toBe(12);
    expect(await fs.readFile(outputPath, "utf-8")).toBe("file content");
  });

  it("writes a Uint8Array to disk", async () => {
    const filePath = path.join(tmpDir, "output.bin");
    const encoder = new TextEncoder();
    const data = encoder.encode("datadatadata");
    const bytes = await bun.write(filePath, data);
    expect(bytes).toBe(data.length);
    expect(await fs.readFile(filePath, "utf-8")).toBe("datadatadata");
  });

  it("writes an ArrayBuffer to disk", async () => {
    const filePath = path.join(tmpDir, "ab.bin");
    const ab = new ArrayBuffer(4);
    new Uint8Array(ab).set([10, 20, 30, 40]);
    const bytes = await bun.write(filePath, ab);
    expect(bytes).toBe(4);
    const result = await fs.readFile(filePath);
    expect([...result]).toEqual([10, 20, 30, 40]);
  });

  it("writes a Response body to disk", async () => {
    const filePath = path.join(tmpDir, "response.txt");
    const response = new Response("response body");
    const bytes = await bun.write(filePath, response);
    expect(bytes).toBe(13);
    expect(await fs.readFile(filePath, "utf-8")).toBe("response body");
  });

  it("writes a Blob to disk", async () => {
    const filePath = path.join(tmpDir, "blob.txt");
    const blob = new Blob(["blob content"]);
    const bytes = await bun.write(filePath, blob);
    expect(bytes).toBe(12);
    expect(await fs.readFile(filePath, "utf-8")).toBe("blob content");
  });

  it("creates parent directories if needed", async () => {
    const filePath = path.join(tmpDir, "deep", "nested", "dir", "file.txt");
    await bun.write(filePath, "deep content");
    expect(await fs.readFile(filePath, "utf-8")).toBe("deep content");
  });
});

// --- FileSink (incremental writing) ---

describe("FileSink", () => {
  it("writes incrementally and flushes to disk", async () => {
    const filePath = path.join(tmpDir, "incremental.txt");
    const file = bun.file(filePath);
    const writer = file.writer();

    writer.write("it was the best of times\n");
    writer.write("it was the worst of times\n");
    writer.flush();

    const content = await fs.readFile(filePath, "utf-8");
    expect(content).toBe(
      "it was the best of times\nit was the worst of times\n"
    );
  });

  it("end() flushes and closes", async () => {
    const filePath = path.join(tmpDir, "end-test.txt");
    const file = bun.file(filePath);
    const writer = file.writer();

    writer.write("final content");
    writer.end();

    expect(await fs.readFile(filePath, "utf-8")).toBe("final content");
  });

  it("supports custom highWaterMark", async () => {
    const filePath = path.join(tmpDir, "hwm.txt");
    const file = bun.file(filePath);
    const writer = file.writer({ highWaterMark: 1024 * 1024 }); // 1MB

    writer.write("big buffer test");
    writer.end();

    expect(await fs.readFile(filePath, "utf-8")).toBe("big buffer test");
  });

  it("auto-flushes when buffer is full", async () => {
    const filePath = path.join(tmpDir, "autoflush.txt");
    const file = bun.file(filePath);
    const writer = file.writer({ highWaterMark: 10 }); // tiny buffer

    // Write more than the buffer size
    writer.write("0123456789ABCD");
    // Should have auto-flushed at least once

    writer.end();
    expect(await fs.readFile(filePath, "utf-8")).toBe("0123456789ABCD");
  });

  it("returns bytes written from write()", () => {
    const filePath = path.join(tmpDir, "bytes-written.txt");
    const writer = bun.file(filePath).writer();
    const written = writer.write("hello");
    expect(written).toBe(5);
    writer.end();
  });
});

// --- Bun.stdin, Bun.stdout, Bun.stderr ---

describe("Bun.stdin, Bun.stdout, Bun.stderr", () => {
  it("stdin is a BunFile-like object", () => {
    expect(bun.stdin).toBeDefined();
    expect(typeof bun.stdin.size).toBe("number");
    expect(typeof bun.stdin.type).toBe("string");
  });

  it("stdout is a BunFile-like object", () => {
    expect(bun.stdout).toBeDefined();
    expect(typeof bun.stdout.size).toBe("number");
  });

  it("stderr is a BunFile-like object", () => {
    expect(bun.stderr).toBeDefined();
    expect(typeof bun.stderr.size).toBe("number");
  });
});
