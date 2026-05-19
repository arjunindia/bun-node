# Bun Utils

> Use Bun's utility functions to work with the runtime

## `Bun.version`

A `string` containing the version of the `bun` CLI that is currently running.

```ts
Bun.version;
// => "1.3.3"
```

## `Bun.revision`

The git commit of Bun that was compiled to create the current `bun` CLI.

```ts
Bun.revision;
// => "f02561530fda1ee9396f51c8bc99b38716e38296"
```

## `Bun.env`

An alias for `process.env`.

## `Bun.main`

An absolute path to the entrypoint of the current program (the file that was executed with `bun run`).

```ts
Bun.main;
// /path/to/script.ts
```

This is particularly useful for determining whether a script is being directly executed, as opposed to being imported by another script.

```ts
if (import.meta.path === Bun.main) {
  // this script is being directly executed
} else {
  // this file is being imported from another script
}
```

This is analogous to the `require.main = module` trick in Node.js.

## `Bun.sleep()`

`Bun.sleep(ms: number)`

Returns a `Promise` that resolves after the given number of milliseconds.

```ts
console.log("hello");
await Bun.sleep(1000);
console.log("hello one second later!");
```

Alternatively, pass a `Date` object to receive a `Promise` that resolves at that point in time.

```ts
const oneSecondInFuture = new Date(Date.now() + 1000);

console.log("hello");
await Bun.sleep(oneSecondInFuture);
console.log("hello one second later!");
```

## `Bun.sleepSync()`

`Bun.sleepSync(ms: number)`

A blocking synchronous version of `Bun.sleep`.

```ts
console.log("hello");
Bun.sleepSync(1000); // blocks thread for one second
console.log("hello one second later!");
```

## `Bun.which()`

`Bun.which(bin: string)`

Returns the path to an executable, similar to typing `which` in your terminal.

```ts
const ls = Bun.which("ls");
console.log(ls); // "/usr/bin/ls"
```

By default Bun looks at the current `PATH` environment variable to determine the path. To configure `PATH`:

```ts
const ls = Bun.which("ls", {
  PATH: "/usr/local/bin:/usr/bin:/bin",
});
console.log(ls); // "/usr/bin/ls"
```

Pass a `cwd` option to resolve for executable from within a specific directory.

```ts
const ls = Bun.which("ls", {
  cwd: "/tmp",
  PATH: "",
});

console.log(ls); // null
```

You can think of this as a builtin alternative to the `which` npm package.

## `Bun.randomUUIDv7()`

`Bun.randomUUIDv7()` returns a UUID v7, which is monotonic and suitable for sorting and databases.

```ts
import { randomUUIDv7 } from "bun";

const id = randomUUIDv7();
// => "0192ce11-26d5-7dc3-9305-1426de888c5a"
```

A UUID v7 is a 128-bit value that encodes the current timestamp, a random value, and a counter. The timestamp is encoded using the lowest 48 bits, and the random value and counter are encoded using the remaining bits.

The `timestamp` parameter defaults to the current time in milliseconds. When the timestamp changes, the counter is reset to a pseudo-random integer wrapped to 4096. This counter is atomic and threadsafe, meaning that using `Bun.randomUUIDv7()` in many Workers within the same process running at the same timestamp will not have colliding counter values.

The final 8 bytes of the UUID are a cryptographically secure random value. It uses the same random number generator used by `crypto.randomUUID()` (which comes from BoringSSL, which in turn comes from the platform-specific system random number generator usually provided by the underlying hardware).

```ts
namespace Bun {
  function randomUUIDv7(encoding?: "hex" | "base64" | "base64url" = "hex", timestamp?: number = Date.now()): string;
  /**
   * If you pass "buffer", you get a 16-byte buffer instead of a string.
   */
  function randomUUIDv7(encoding: "buffer", timestamp?: number = Date.now()): Buffer;

  // If you only pass a timestamp, you get a hex string
  function randomUUIDv7(timestamp?: number = Date.now()): string;
}
```

You can optionally set encoding to `"buffer"` to get a 16-byte buffer instead of a string. This can sometimes avoid string conversion overhead.

```ts
const buffer = Bun.randomUUIDv7("buffer");
```

`base64` and `base64url` encodings are also supported when you want a slightly shorter string.

```ts
const base64 = Bun.randomUUIDv7("base64");
const base64url = Bun.randomUUIDv7("base64url");
```

## `Bun.peek()`

`Bun.peek(prom: Promise)`

Reads a promise's result without `await` or `.then`, but only if the promise has already fulfilled or rejected.

```ts
import { peek } from "bun";

const promise = Promise.resolve("hi");

// no await!
const result = peek(promise);
console.log(result); // "hi"
```

This is important when attempting to reduce the number of extraneous microticks in performance-sensitive code. It's an advanced API — review the examples below before using it in production.

```ts
import { peek } from "bun";
import { expect, test } from "bun:test";

test("peek", () => {
  const promise = Promise.resolve(true);

  // no await necessary!
  expect(peek(promise)).toBe(true);

  // if we peek again, it returns the same value
  const again = peek(promise);
  expect(again).toBe(true);

  // if we peek a non-promise, it returns the value
  const value = peek(42);
  expect(value).toBe(42);

  // if we peek a pending promise, it returns the promise again
  const pending = new Promise(() => {});
  expect(peek(pending)).toBe(pending);

  // If we peek a rejected promise, it:
  // - returns the error
  // - does not mark the promise as handled
  const rejected = Promise.reject(new Error("Successfully tested promise rejection"));
  expect(peek(rejected).message).toBe("Successfully tested promise rejection");
});
```

The `peek.status` function lets you read the status of a promise without resolving it.

```ts
import { peek } from "bun";
import { expect, test } from "bun:test";

test("peek.status", () => {
  const promise = Promise.resolve(true);
  expect(peek.status(promise)).toBe("fulfilled");

  const pending = new Promise(() => {});
  expect(peek.status(pending)).toBe("pending");

  const rejected = Promise.reject(new Error("oh nooo"));
  expect(peek.status(rejected)).toBe("rejected");
});
```

## `Bun.openInEditor()`

Opens a file in your default editor. Bun auto-detects your editor via the `$VISUAL` or `$EDITOR` environment variables.

```ts
const currentFile = import.meta.url;
Bun.openInEditor(currentFile);
```

You can override this via the `debug.editor` setting in your `bunfig.toml`.

```toml bunfig.toml
[debug]
editor = "code"
```

Or specify an editor with the `editor` param. You can also specify a line and column number.

```ts
Bun.openInEditor(import.meta.url, {
  editor: "vscode", // or "subl"
  line: 10,
  column: 5,
});
```

## `Bun.deepEquals()`

Recursively checks if two objects are equivalent. `expect().toEqual()` in `bun:test` uses this internally.

```ts
const foo = { a: 1, b: 2, c: { d: 3 } };

// true
Bun.deepEquals(foo, { a: 1, b: 2, c: { d: 3 } });

// false
Bun.deepEquals(foo, { a: 1, b: 2, c: { d: 4 } });
```

Pass a third boolean parameter to enable "strict" mode. `expect().toStrictEqual()` in the test runner uses this.

```ts
const a = { entries: [1, 2] };
const b = { entries: [1, 2], extra: undefined };

Bun.deepEquals(a, b); // => true
Bun.deepEquals(a, b, true); // => false
```

In strict mode, the following are considered unequal:

```ts
// undefined values
Bun.deepEquals({}, { a: undefined }, true); // false

// undefined in arrays
Bun.deepEquals(["asdf"], ["asdf", undefined], true); // false

// sparse arrays
Bun.deepEquals([, 1], [undefined, 1], true); // false

// object literals vs instances w/ same properties
class Foo {
  a = 1;
}
Bun.deepEquals(new Foo(), { a: 1 }, true); // false
```

## `Bun.escapeHTML()`

`Bun.escapeHTML(value: string | object | number | boolean): string`

Escapes the following characters from an input string:

* `"` becomes `&quot;`
* `&` becomes `&amp;`
* `'` becomes `&#x27;`
* `<` becomes `&lt;`
* `>` becomes `&gt;`

This function is optimized for large input. On an M1X, it processes 480 MB/s - 20 GB/s, depending on how much data is being escaped and whether there is non-ascii text. Non-string types will be converted to a string before escaping.

## `Bun.stringWidth()`

Get the column count of a string as it would be displayed in a terminal. Supports ANSI escape codes, emoji, and wide characters.

Example usage:

```ts
Bun.stringWidth("hello"); // => 5
Bun.stringWidth("\u001b[31mhello\u001b[0m"); // => 5
Bun.stringWidth("\u001b[31mhello\u001b[0m", { countAnsiEscapeCodes: true }); // => 12
```

This is useful for:

* Aligning text in a terminal
* Quickly checking if a string contains ANSI escape codes
* Measuring the width of a string in a terminal

This API is designed to match the popular "string-width" package, so that existing code can be ported to Bun and vice versa.

TypeScript definition:

```ts
namespace Bun {
  export function stringWidth(
    input: string,
    options?: {
      countAnsiEscapeCodes?: boolean;
      ambiguousIsNarrow?: boolean;
    },
  ): number;
}
```

## `Bun.fileURLToPath()`

Converts a `file://` URL to an absolute path.

```ts
const path = Bun.fileURLToPath(new URL("file:///foo/bar.txt"));
console.log(path); // "/foo/bar.txt"
```

## `Bun.pathToFileURL()`

Converts an absolute path to a `file://` URL.

```ts
const url = Bun.pathToFileURL("/foo/bar.txt");
console.log(url); // "file:///foo/bar.txt"
```

## `Bun.gzipSync()`

Compresses a `Uint8Array` using zlib's GZIP algorithm.

```ts
const buf = Buffer.from("hello".repeat(100)); // Buffer extends Uint8Array
const compressed = Bun.gzipSync(buf);

buf; // => Uint8Array(500)
compressed; // => Uint8Array(30)
```

Optionally, pass a parameters object as the second argument with options for `level`, `memLevel`, `windowBits`, and `strategy`.

## `Bun.gunzipSync()`

Decompresses a `Uint8Array` using zlib's GUNZIP algorithm.

```ts
const buf = Buffer.from("hello".repeat(100)); // Buffer extends Uint8Array
const compressed = Bun.gzipSync(buf);

const dec = new TextDecoder();
const uncompressed = Bun.gunzipSync(compressed);
dec.decode(uncompressed);
// => "hellohellohello..."
```

## `Bun.deflateSync()`

Compresses a `Uint8Array` using zlib's DEFLATE algorithm.

```ts
const buf = Buffer.from("hello".repeat(100));
const compressed = Bun.deflateSync(buf);

buf; // => Buffer(500)
compressed; // => Uint8Array(12)
```

The second argument supports the same set of configuration options as `Bun.gzipSync`.

## `Bun.inflateSync()`

Decompresses a `Uint8Array` using zlib's INFLATE algorithm.

```ts
const buf = Buffer.from("hello".repeat(100));
const compressed = Bun.deflateSync(buf);

const dec = new TextDecoder();
const decompressed = Bun.inflateSync(compressed);
dec.decode(decompressed);
// => "hellohellohello..."
```

## `Bun.zstdCompress()` / `Bun.zstdCompressSync()`

Compresses a `Uint8Array` using the Zstandard algorithm.

```ts
const buf = Buffer.from("hello".repeat(100));

// Synchronous
const compressedSync = Bun.zstdCompressSync(buf);
// Asynchronous
const compressedAsync = await Bun.zstdCompress(buf);

// With compression level (1-22, default: 3)
const compressedLevel = Bun.zstdCompressSync(buf, { level: 6 });
```

## `Bun.zstdDecompress()` / `Bun.zstdDecompressSync()`

Decompresses a `Uint8Array` using the Zstandard algorithm.

```ts
const buf = Buffer.from("hello".repeat(100));
const compressed = Bun.zstdCompressSync(buf);

// Synchronous
const decompressedSync = Bun.zstdDecompressSync(compressed);
// Asynchronous
const decompressedAsync = await Bun.zstdDecompress(compressed);

const dec = new TextDecoder();
dec.decode(decompressedSync);
// => "hellohellohello..."
```

## `Bun.inspect()`

Serializes an object to a `string` exactly as it would be printed by `console.log`.

```ts
const obj = { foo: "bar" };
const str = Bun.inspect(obj);
// => '{\nfoo: "bar" \n}'

const arr = new Uint8Array([1, 2, 3]);
const str = Bun.inspect(arr);
// => "Uint8Array(3) [ 1, 2, 3 ]"
```

### `Bun.inspect.custom`

This is the symbol that Bun uses to implement `Bun.inspect`. You can override this to customize how your objects are printed. It is identical to `util.inspect.custom` in Node.js.

```ts
class Foo {
  [Bun.inspect.custom]() {
    return "foo";
  }
}

const foo = new Foo();
console.log(foo); // => "foo"
```

### `Bun.inspect.table(tabularData, properties, options)`

Format tabular data into a string. Like `console.table`, except it returns a string rather than printing to the console.

```ts
console.log(
  Bun.inspect.table([
    { a: 1, b: 2, c: 3 },
    { a: 4, b: 5, c: 6 },
    { a: 7, b: 8, c: 9 },
  ]),
);
//
// ┌───┬───┬───┬───┐
// │   │ a │ b │ c │
// ├───┼───┼───┼───┤
// │ 0 │ 1 │ 2 │ 3 │
// │ 1 │ 4 │ 5 │ 6 │
// │ 2 │ 7 │ 8 │ 9 │
// └───┴───┴───┴───┘
```

Additionally, you can pass an array of property names to display only a subset of properties.

```ts
console.log(
  Bun.inspect.table(
    [
      { a: 1, b: 2, c: 3 },
      { a: 4, b: 5, c: 6 },
    ],
    ["a", "c"],
  ),
);
//
// ┌───┬───┬───┐
// │   │ a │ c │
// ├───┼───┼───┤
// │ 0 │ 1 │ 3 │
// │ 1 │ 4 │ 6 │
// └───┴───┴───┘
```

You can also conditionally enable ANSI colors by passing `{ colors: true }`.

## `Bun.nanoseconds()`

Returns the number of nanoseconds since the current `bun` process started, as a `number`. Useful for high-precision timing and benchmarking.

```ts
Bun.nanoseconds();
// => 7288958
```

## `Bun.readableStreamTo*()`

Bun implements a set of convenience functions for asynchronously consuming the body of a `ReadableStream` and converting it to various binary formats.

```ts
const stream = (await fetch("https://bun.com")).body;
stream; // => ReadableStream

await Bun.readableStreamToArrayBuffer(stream);
// => ArrayBuffer

await Bun.readableStreamToBytes(stream);
// => Uint8Array

await Bun.readableStreamToBlob(stream);
// => Blob

await Bun.readableStreamToJSON(stream);
// => object

await Bun.readableStreamToText(stream);
// => string

// returns all chunks as an array
await Bun.readableStreamToArray(stream);
// => unknown[]

// returns all chunks as a FormData object (encoded as x-www-form-urlencoded)
await Bun.readableStreamToFormData(stream);

// returns all chunks as a FormData object (encoded as multipart/form-data)
await Bun.readableStreamToFormData(stream, multipartFormBoundary);
```

## `Bun.resolveSync()`

Resolves a file path or module specifier using Bun's internal module resolution algorithm. The first argument is the path to resolve, and the second argument is the "root". If no match is found, an `Error` is thrown.

```ts
Bun.resolveSync("./foo.ts", "/path/to/project");
// => "/path/to/project/foo.ts"

Bun.resolveSync("zod", "/path/to/project");
// => "/path/to/project/node_modules/zod/index.ts"
```

To resolve relative to the current working directory, pass `process.cwd()` or `"."` as the root.

```ts
Bun.resolveSync("./foo.ts", process.cwd());
Bun.resolveSync("./foo.ts", "/path/to/project");
```

To resolve relative to the directory containing the current file, pass `import.meta.dir`.

```ts
Bun.resolveSync("./foo.ts", import.meta.dir);
```

## `Bun.stripANSI()`

`Bun.stripANSI(text: string): string`

Strip ANSI escape codes from a string. This is useful for removing colors and formatting from terminal output.

```ts
const coloredText = "\u001b[31mHello\u001b[0m \u001b[32mWorld\u001b[0m";
const plainText = Bun.stripANSI(coloredText);
console.log(plainText); // => "Hello World"

// Works with various ANSI codes
const formatted = "\u001b[1m\u001b[4mBold and underlined\u001b[0m";
console.log(Bun.stripANSI(formatted)); // => "Bold and underlined"
```

`Bun.stripANSI` is significantly faster than the popular `strip-ansi` npm package.

## `Bun.wrapAnsi()`

`Bun.wrapAnsi(input: string, columns: number, options?: WrapAnsiOptions): string`

Wrap text to a specified column width while preserving ANSI escape codes, hyperlinks, and handling Unicode/emoji width correctly. This is a native, high-performance alternative to the popular `wrap-ansi` npm package.

```ts
// Basic wrapping at 20 columns
Bun.wrapAnsi("The quick brown fox jumps over the lazy dog", 20);
// => "The quick brown fox\njumps over the lazy\ndog"

// Preserves ANSI escape codes
Bun.wrapAnsi("\u001b[31mThe quick brown fox jumps over the lazy dog\u001b[0m", 20);
// => "\u001b[31mThe quick brown fox\njumps over the lazy\ndog\u001b[0m"
```

### Options

```ts
Bun.wrapAnsi("Hello World", 5, {
  hard: true, // Break words that exceed column width (default: false)
  wordWrap: true, // Wrap at word boundaries (default: true)
  trim: true, // Trim leading/trailing whitespace per line (default: true)
  ambiguousIsNarrow: true, // Treat ambiguous-width characters as narrow (default: true)
});
```

| Option              | Default | Description                                                                                                     |
| ------------------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `hard`              | `false` | If `true`, break words in the middle if they exceed the column width.                                           |
| `wordWrap`          | `true`  | If `true`, wrap at word boundaries. If `false`, only break at explicit newlines.                                |
| `trim`              | `true`  | If `true`, trim leading and trailing whitespace from each line.                                                 |
| `ambiguousIsNarrow` | `true`  | If `true`, treat ambiguous-width Unicode characters as 1 column wide. If `false`, treat them as 2 columns wide. |

## `serialize` & `deserialize` in `bun:jsc`

To save a JavaScript value into an ArrayBuffer & back, use `serialize` and `deserialize` from the `"bun:jsc"` module.

```js
import { serialize, deserialize } from "bun:jsc";

const buf = serialize({ foo: "bar" });
const obj = deserialize(buf);
console.log(obj); // => { foo: "bar" }
```

Internally, `structuredClone` and `postMessage` serialize and deserialize the same way. This exposes the underlying HTML Structured Clone Algorithm to JavaScript as an ArrayBuffer.

## `estimateShallowMemoryUsageOf` in `bun:jsc`

The `estimateShallowMemoryUsageOf` function returns a best-effort estimate of the memory usage of an object in bytes, excluding the memory usage of properties or other objects it references. For accurate per-object memory usage, use `Bun.generateHeapSnapshot`.

```js
import { estimateShallowMemoryUsageOf } from "bun:jsc";

const obj = { foo: "bar" };
const usage = estimateShallowMemoryUsageOf(obj);
console.log(usage); // => 16

const buffer = Buffer.alloc(1024 * 1024);
estimateShallowMemoryUsageOf(buffer);
// => 1048624

const req = new Request("https://bun.com");
estimateShallowMemoryUsageOf(req);
// => 167

const array = Array(1024).fill({ a: 1 });
// Arrays are usually not stored contiguously in memory, so this will not return a useful value (which isn't a bug).
estimateShallowMemoryUsageOf(array);
// => 16
```
