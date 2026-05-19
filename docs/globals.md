# Bun-Specific Globals & Scope

Bun adds several globals and properties to the JavaScript runtime that go beyond Node.js compatibility. These are available without imports.

---

## The `Bun` Global Object

The entire `Bun` namespace is available globally. You can also import specific members:

```ts
import { file, serve, sleep } from "bun";
```

### Properties

| Property | Description |
|----------|-------------|
| `Bun.version` | String containing the Bun CLI version (e.g., `"1.3.3"`) |
| `Bun.revision` | Git commit hash of the Bun build |
| `Bun.env` | Alias for `process.env` |
| `Bun.main` | Absolute path to the entrypoint file |
| `Bun.argv` | Array of command-line arguments (like `process.argv`) |

### Timing & Sleep

```ts
// Async sleep - returns a Promise
await Bun.sleep(1000);           // sleep 1 second
await Bun.sleep(new Date(...));  // sleep until a specific Date

// Blocking sleep
Bun.sleepSync(1000);             // blocks the thread

// High-precision timing
Bun.nanoseconds();               // nanoseconds since process started
```

### UUID

```ts
// Monotonic UUID v7 - suitable for database primary keys
Bun.randomUUIDv7();                          // hex string
Bun.randomUUIDv7("base64");                  // base64 string
Bun.randomUUIDv7("base64url");               // base64url string
Bun.randomUUIDv7("buffer");                  // 16-byte Buffer
Bun.randomUUIDv7("hex", Date.now());         // with custom timestamp
```

### System Utilities

```ts
// Find an executable on PATH
Bun.which("ls");                // "/usr/bin/ls"
Bun.which("ls", { PATH: "/usr/bin", cwd: "/tmp" });
```

### Promise Utilities

```ts
// Read a promise result without await (only if already settled)
const result = Bun.peek(promise);
const status = Bun.peek.status(promise); // "fulfilled" | "pending" | "rejected"
```

### Deep Comparison

```ts
Bun.deepEquals(obj1, obj2);            // recursive equality
Bun.deepEquals(obj1, obj2, true);      // strict mode (no undefined mismatches)
```

### Inspection & Serialization

```ts
Bun.inspect(obj);                      // like console.log output as string
Bun.inspect.custom                     // Symbol for custom inspection
Bun.inspect.table(data, cols, opts);   // tabular format as string
```

### String Processing

```ts
Bun.escapeHTML('<script>alert("xss")</script>');  // escape HTML entities
Bun.stringWidth("hello");                           // terminal column width
Bun.stringWidth(str, { countAnsiEscapeCodes: true });
Bun.stripANSI("\u001b[31mhello\u001b[0m");         // strip ANSI codes
Bun.wrapAnsi(text, columns, options);               // wrap text preserving ANSI
```

### URL & Path Conversion

```ts
Bun.fileURLToPath(new URL("file:///foo/bar.txt"));  // "/foo/bar.txt"
Bun.pathToFileURL("/foo/bar.txt");                   // "file:///foo/bar.txt"
```

### Compression

```ts
// Gzip
Bun.gzipSync(buf);          // compress
Bun.gunzipSync(buf);        // decompress

// Deflate
Bun.deflateSync(buf);       // compress
Bun.inflateSync(buf);       // decompress

// Zstandard
await Bun.zstdCompress(buf);           // async compress
Bun.zstdCompressSync(buf);             // sync compress
await Bun.zstdDecompress(buf);         // async decompress
Bun.zstdDecompressSync(buf);           // sync decompress
// With options: { level: 1-22 }
```

### Stream Consumption

```ts
const stream = (await fetch("...")).body;
await Bun.readableStreamToArrayBuffer(stream);
await Bun.readableStreamToBytes(stream);
await Bun.readableStreamToBlob(stream);
await Bun.readableStreamToJSON(stream);
await Bun.readableStreamToText(stream);
await Bun.readableStreamToArray(stream);
await Bun.readableStreamToFormData(stream, boundary?);
```

### Module Resolution

```ts
Bun.resolveSync("./foo.ts", "/path/to/project");
Bun.resolveSync("zod", import.meta.dir);
```

### Editor Integration

```ts
Bun.openInEditor(import.meta.url);
Bun.openInEditor(file, { editor: "vscode", line: 10, column: 5 });
```

### Low-level / Memory

```ts
Bun.gc();                          // trigger garbage collection
Bun.gc({ runSweep: true });        // GC with sweep
Bun.generateHeapSnapshot();        // heap snapshot as JSON
Bun.mmap(fd, opts);                // memory-mapped file I/O
Bun.allocUnsafe(size);             // allocate uninitialized buffer
Bun.concatArrayBuffers(bufs);      // concatenate ArrayBuffers
Bun.indexOfLine(buf, offset);      // find newline index
```

---

## The `$` Global (Shell)

The `$` function is available globally for shell commands:

```ts
import { $ } from "bun";

const result = await $`echo hello`.text();
const result = await $`echo hello`.json();
const result = await $`echo hello`.arrayBuffer();
const result = await $`echo hello`.blob();

// With options
await $`echo hello`.env({ FOO: "bar" }).cwd("/tmp").text();
```

---

## The `HTMLRewriter` Global

Available globally for streaming HTML transformation:

```ts
const rewriter = new HTMLRewriter()
  .on("div", { element(el) { /* ... */ } })
  .on("p", { text(t) { /* ... */ } });
```

---

## `import.meta` Properties (Bun-Specific)

| Property | Description |
|----------|-------------|
| `import.meta.dir` | Absolute directory path (like `__dirname`) |
| `import.meta.dirname` | Alias for `import.meta.dir` |
| `import.meta.file` | Current filename |
| `import.meta.path` | Absolute file path (like `__filename`) |
| `import.meta.filename` | Alias for `import.meta.path` |
| `import.meta.url` | File URL string |
| `import.meta.main` | `true` if this file is the entrypoint |
| `import.meta.env` | Alias for `process.env` |
| `import.meta.resolve(specifier)` | Resolve a module specifier to a URL |

---

## Built-in Modules

| Module | Description |
|--------|-------------|
| `bun:sqlite` | Built-in SQLite driver |
| `bun:ffi` | Foreign Function Interface |
| `bun:test` | Test runner |
| `bun:jsc` | JavaScriptCore internals (`serialize`, `deserialize`, `estimateShallowMemoryUsageOf`) |

---

## Additional `bun:jsc` APIs

```ts
import { serialize, deserialize, estimateShallowMemoryUsageOf } from "bun:jsc";

// Serialize a value to ArrayBuffer (same as structuredClone's algorithm)
const buf = serialize({ foo: "bar" });
const obj = deserialize(buf);

// Estimate memory usage of an object
const bytes = estimateShallowMemoryUsageOf({ foo: "bar" });
```
