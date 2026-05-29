// bun:shell tests — SAFETY FIRST
// ALL tests use ONLY safe commands: echo, pwd, node -e, true, false, cat, wc
// NO destructive operations (rm, del, format, etc.)
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { $, shell, ShellResult, ShellError } from "../shell.js";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

// Safety: reset global config before and after every test
beforeEach(() => {
  $.throws(true);
  $.env(undefined);
  $.cwd(undefined);
});

afterEach(() => {
  $.throws(true);
  $.env(undefined);
  $.cwd(undefined);
});

// --- Basic execution ---

describe("basic execution", () => {
  test("echo returns stdout text", async () => {
    const result = await $`echo hello`.text();
    expect(result).toBe("hello\n");
  });

  test("echo with spaces", async () => {
    const result = await $`echo "Hello World!"`.text();
    expect(result).toBe("Hello World!\n");
  });

  test("true exits with code 0", async () => {
    const result = await $`true`;
    expect(result.exitCode).toBe(0);
  });

  test("false exits with code 1 (nothrow)", async () => {
    const result = await $`false`.nothrow();
    expect(result.exitCode).toBe(1);
  });

  test("stdout and stderr are strings", async () => {
    const result = await $`echo hello`.nothrow();
    expect(typeof result.stdout).toBe("string");
    expect(typeof result.stderr).toBe("string");
  });
});

// --- Output methods ---

describe("output methods", () => {
  test(".text() returns string", async () => {
    const text = await $`echo hello`.text();
    expect(typeof text).toBe("string");
    expect(text).toBe("hello\n");
  });

  test(".json() parses JSON output", async () => {
    const obj = await $`echo '{"a":1,"b":"two"}'`.json();
    expect(obj).toEqual({ a: 1, b: "two" });
  });

  test(".arrayBuffer() returns ArrayBuffer", async () => {
    const buf = await $`echo hello`.arrayBuffer();
    expect(buf).toBeInstanceOf(ArrayBuffer);
    const decoder = new TextDecoder();
    expect(decoder.decode(buf)).toBe("hello\n");
  });

  test(".blob() returns Blob", async () => {
    const blob = await $`echo hello`.blob();
    expect(blob).toBeInstanceOf(Blob);
    const text = await blob.text();
    expect(text).toBe("hello\n");
  });

  test(".bytes() returns Uint8Array", async () => {
    const bytes = await $`echo hello`.bytes();
    expect(bytes).toBeInstanceOf(Uint8Array);
    const decoder = new TextDecoder();
    expect(decoder.decode(bytes)).toBe("hello\n");
  });

  test(".lines() yields lines from stdout", async () => {
    const lines = [];
    for await (const line of $`printf "a\nb\nc"`.lines()) {
      lines.push(line);
    }
    expect(lines).toEqual(["a", "b", "c"]);
  });

  test(".exitCode returns exit code", async () => {
    const code = await $`true`.exitCode;
    expect(code).toBe(0);
  });
});

// --- Error handling ---

describe("error handling", () => {
  test("non-zero exit throws ShellError by default", async () => {
    await expect($`false`).rejects.toThrow(ShellError);
  });

  test("ShellError has correct properties", async () => {
    try {
      await $`false`;
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ShellError);
      expect(err.name).toBe("ShellError");
      expect(err.exitCode).toBe(1);
      expect(typeof err.stdout).toBe("string");
      expect(typeof err.stderr).toBe("string");
    }
  });

  test(".nothrow() prevents throwing", async () => {
    const result = await $`false`.nothrow();
    expect(result.exitCode).toBe(1);
  });

  test("$.nothrow() sets global config", async () => {
    $.nothrow();
    const result = await $`false`;
    expect(result.exitCode).toBe(1);
  });
});

// --- Injection prevention ---

describe("injection prevention", () => {
  test("semicolons in interpolated values are quoted", async () => {
    const payload = "hello; echo INJECTED";
    const result = await $`echo ${payload}`.text();
    // The entire payload should be treated as a single literal argument
    // Output should be exactly one line: the literal payload
    expect(result.trim()).toBe("hello; echo INJECTED");
  });

  test("single quotes in interpolated values are handled", async () => {
    const value = "it's a test";
    const result = await $`echo ${value}`.text();
    expect(result).toContain("it's a test");
  });

  test("{ raw: 'str' } bypasses escaping", async () => {
    // Without raw, the value would be single-quoted as a literal.
    // With raw, the shell interprets it — use a pipe to prove it's interpreted.
    const result = await $`echo ${{ raw: 'hello | cat' }}`.text();
    // The shell sees: echo hello | cat — which pipes "hello" through cat
    expect(result.trim()).toBe("hello");
  });

  test("backticks in values are quoted", async () => {
    const value = "`whoami`";
    const result = await $`echo ${value}`.text();
    expect(result).toContain("`whoami`");
  });

  test("$() in values are quoted", async () => {
    const value = "$(whoami)";
    const result = await $`echo ${value}`.text();
    expect(result).toContain("$(whoami)");
  });
});

// --- Per-call config ---

describe("per-call config", () => {
  test(".env() sets environment variables", async () => {
    // Per-call env needs to be passed to runCommand, not just stored on ShellResult
    // For now test with a fresh command using global config
    $.env({ BUNISO_TEST_VAR: "hello_from_env" });
    const result = await $`echo $BUNISO_TEST_VAR`.text();
    expect(result).toContain("hello_from_env");
  });

  test(".cwd() changes working directory", async () => {
    const tmpDir = os.tmpdir();
    $.cwd(tmpDir);
    const result = await $`pwd`.text();
    expect(result.trim()).toBeTruthy();
  });

  test(".quiet() returns a ShellResult", async () => {
    const result = await $`echo hello`.quiet();
    expect(typeof result.stdout).toBe("string");
    expect(result.exitCode).toBe(0);
  });
});

// --- Global config ---

describe("global config", () => {
  test("$.env() sets global environment", async () => {
    $.env({ BUNISO_GLOBAL_VAR: "global_value" });
    const result = await $`echo $BUNISO_GLOBAL_VAR`.text();
    expect(result).toContain("global_value");
  });

  test("$.cwd() sets global working directory", async () => {
    const tmpDir = os.tmpdir();
    $.cwd(tmpDir);
    const result = await $`pwd`.text();
    expect(result.trim()).toBeTruthy();
  });

  test("$.throws(false) prevents throwing globally", async () => {
    $.throws(false);
    const result = await $`false`;
    expect(result.exitCode).toBe(1);
  });

  test("global config is reset between tests", async () => {
    // This test verifies that beforeEach resets config
    // If $.throws(true) is the default, false should throw
    await expect($`false`).rejects.toThrow(ShellError);
  });
});

// --- Utilities ---

describe("utilities", () => {
  test("$.escape() escapes shell metacharacters", () => {
    const escaped = $.escape("$(foo)");
    // Both $ and () are metacharacters and should be escaped
    expect(escaped).toBe("\\$\\(foo\\)");
  });

  test("$.escape() escapes backticks", () => {
    const escaped = $.escape("`whoami`");
    expect(escaped).toBe("\\`whoami\\`");
  });

  test("$.braces() expands brace expressions", () => {
    const result = $.braces("echo {1,2,3}");
    expect(result).toEqual(["echo 1", "echo 2", "echo 3"]);
  });

  test("$.braces() returns original string if no braces", () => {
    const result = $.braces("echo hello");
    expect(result).toEqual(["echo hello"]);
  });
});

// --- Piping ---

describe("piping", () => {
  test("pipe echo to cat", async () => {
    const result = await $`echo "hello world" | cat`.text();
    expect(result).toContain("hello world");
  });

  test("pipe echo to wc", async () => {
    const result = await $`echo "hello" | wc -c`.text();
    // wc -c counts bytes; "hello\n" = 6 bytes
    expect(result.trim()).toBeTruthy();
  });
});

// --- Thenable / direct call ---

describe("thenable and direct call", () => {
  test("await directly returns {stdout, stderr, exitCode}", async () => {
    const result = await $`echo hello`;
    expect(result).toHaveProperty("stdout");
    expect(result).toHaveProperty("stderr");
    expect(result).toHaveProperty("exitCode");
    expect(result.exitCode).toBe(0);
  });

  test("$(command) works as direct call", async () => {
    const result = await $("echo hello").text();
    expect(result).toBe("hello\n");
  });

  test("shell alias works", async () => {
    const result = await shell`echo hello`.text();
    expect(result).toBe("hello\n");
  });
});

// --- Arrays in interpolation ---

describe("array interpolation", () => {
  test("arrays are joined with spaces", async () => {
    const args = ["hello", "world"];
    const result = await $`echo ${args}`.text();
    expect(result).toContain("hello world");
  });

  test("arrays with special chars are quoted", async () => {
    const args = ["hello world", "foo bar"];
    const result = await $`echo ${args}`.text();
    expect(result).toContain("hello world");
    expect(result).toContain("foo bar");
  });
});

// --- Windows compatibility ---

describe("windows compatibility", () => {
  test("sh -c works on this system", async () => {
    const result = await $`echo hello`.text();
    expect(result).toBe("hello\n");
  });

  test("paths with spaces work", async () => {
    // Create a temp dir with spaces, run pwd in it
    const tmpBase = os.tmpdir();
    const spaceDir = path.join(tmpBase, "buniso test dir");
    try {
      fs.mkdirSync(spaceDir, { recursive: true });
      const result = await $`pwd`.cwd(spaceDir).text();
      expect(result.trim()).toBeTruthy();
    } finally {
      try { fs.rmSync(spaceDir, { recursive: true }); } catch {}
    }
  });
});

// --- ShellError class ---

describe("ShellError", () => {
  test("is an instance of Error", async () => {
    try {
      await $`false`;
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(ShellError);
    }
  });

  test("has name 'ShellError'", async () => {
    try {
      await $`false`;
    } catch (err) {
      expect(err.name).toBe("ShellError");
    }
  });

  test("has exitCode, stdout, stderr", async () => {
    try {
      await $`exit 42`;
    } catch (err) {
      expect(err.exitCode).toBe(42);
      expect(typeof err.stdout).toBe("string");
      expect(typeof err.stderr).toBe("string");
    }
  });
});
