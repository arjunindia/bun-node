# Bun File I/O

## Overview

Bun offers optimized APIs for file reading and writing. The `Bun.file` and `Bun.write` APIs are the recommended approach for file-system operations. For operations not yet available via `Bun.file` (like `mkdir` or `readdir`), Bun provides a near-complete `node:fs` implementation.

## Reading Files (`Bun.file()`)

**Signature:** `Bun.file(path): BunFile`

Calling `Bun.file(path)` creates a `BunFile` instance that is lazily-loaded — initialization does not read from disk.

```ts
const foo = Bun.file("foo.txt"); // relative to cwd
foo.size; // number of bytes
foo.type; // MIME type
```

The `BunFile` conforms to the `Blob` interface, enabling multiple read formats:

```ts
const foo = Bun.file("foo.txt");

await foo.text();         // contents as a string
await foo.json();         // contents as a JSON object
await foo.stream();       // contents as ReadableStream
await foo.arrayBuffer();  // contents as ArrayBuffer
await foo.bytes();        // contents as Uint8Array
```

File references can also be created from numerical file descriptors or `file://` URLs:

```ts
Bun.file(1234);
Bun.file(new URL(import.meta.url)); // reference to the current file
```

A `BunFile` can reference a nonexistent path on disk:

```ts
const notreal = Bun.file("notreal.txt");
notreal.size; // 0
notreal.type; // "text/plain;charset=utf-8"
const exists = await notreal.exists(); // false
```

The default MIME type is `text/plain;charset=utf-8`. Override it with a second argument:

```ts
const notreal = Bun.file("notreal.json", { type: "application/json" });
notreal.type; // => "application/json;charset=utf-8"
```

Bun exposes `stdin`, `stdout`, and `stderr` as `BunFile` instances:

```ts
Bun.stdin;  // readonly
Bun.stdout;
Bun.stderr;
```

### Deleting Files (`file.delete()`)

```ts
await Bun.file("logs.json").delete();
```

## Writing Files (`Bun.write()`)

**Signature:** `Bun.write(destination, data): Promise<number>`

### Destination (first argument) — accepts:
- **`string`**: A filesystem path
- **`URL`**: A `file://` descriptor
- **`BunFile`**: A file reference

### Data (second argument) — accepts:
- `string`
- `Blob` (including `BunFile`)
- `ArrayBuffer` or `SharedArrayBuffer`
- `TypedArray` (`Uint8Array`, etc.)
- `Response`

### System Call Details

| Output | Input | System call | Platform |
|---|---|---|---|
| file | file | copy_file_range | Linux |
| file | pipe | sendfile | Linux |
| pipe | pipe | splice | Linux |
| terminal | file | sendfile | Linux |
| terminal | terminal | sendfile | Linux |
| socket | file or pipe | sendfile (if http, not https) | Linux |
| file (doesn't exist) | file (path) | clonefile | macOS |
| file (exists) | file | fcopyfile | macOS |
| file | Blob or string | write | macOS |
| file | Blob or string | write | Linux |

### Writing a string to disk:

```ts
const data = `It was the best of times, it was the worst of times.`;
await Bun.write("output.txt", data);
```

### Copying a file:

```ts
const input = Bun.file("input.txt");
const output = Bun.file("output.txt"); // doesn't exist yet!
await Bun.write(output, input);
```

### Writing a byte array:

```ts
const encoder = new TextEncoder();
const data = encoder.encode("datadatadata"); // Uint8Array
await Bun.write("output.txt", data);
```

### Writing a file to stdout:

```ts
const input = Bun.file("input.txt");
await Bun.write(Bun.stdout, input);
```

### Writing an HTTP response body to disk:

```ts
const response = await fetch("https://bun.com");
await Bun.write("index.html", response);
```

## Incremental Writing with `FileSink`

Bun provides a native incremental file writing API. Obtain a `FileSink` from a `BunFile`:

```ts
const file = Bun.file("output.txt");
const writer = file.writer();
```

Write incrementally using `.write()`:

```ts
writer.write("it was the best of times\n");
writer.write("it was the worst of times\n");
```

Chunks are buffered internally. Flush to disk with `.flush()`, which returns the number of flushed bytes:

```ts
writer.flush(); // write buffer to disk
```

The buffer auto-flushes when the high water mark (internal buffer capacity) is reached. This value is configurable:

```ts
const writer = file.writer({ highWaterMark: 1024 * 1024 }); // 1MB
```

Flush and close the file:

```ts
writer.end();
```

By default, the `bun` process stays alive until the `FileSink` is explicitly closed. To change this:

```ts
writer.unref();
writer.ref(); // to "re-ref" it later
```

## Directories

Bun's `node:fs` implementation is fast and is used for directory operations.

### Reading Directories (`readdir`)

```ts
import { readdir } from "node:fs/promises";
const files = await readdir(import.meta.dir);
```

### Reading Directories Recursively

```ts
import { readdir } from "node:fs/promises";
const files = await readdir("../", { recursive: true });
```

### Creating Directories (`mkdir`)

```ts
import { mkdir } from "node:fs/promises";
await mkdir("path/to/dir", { recursive: true });
```

## Benchmarks

A 3-line `cat` implementation:

```ts
// cat.ts — Usage: bun ./cat.ts ./path-to-file
import { resolve } from "path";

const path = resolve(process.argv.at(-1));
await Bun.write(Bun.stdout, Bun.file(path));
```

This runs approximately 2x faster than GNU `cat` for large files on Linux.

## API Reference

```ts
interface Bun {
  stdin: BunFile;
  stdout: BunFile;
  stderr: BunFile;

  file(path: string | number | URL, options?: { type?: string }): BunFile;

  write(
    destination: string | number | BunFile | URL,
    input: string | Blob | ArrayBuffer | SharedArrayBuffer | TypedArray | Response,
  ): Promise<number>;
}

interface BunFile {
  readonly size: number;
  readonly type: string;

  text(): Promise<string>;
  stream(): ReadableStream;
  arrayBuffer(): Promise<ArrayBuffer>;
  json(): Promise<any>;
  writer(params: { highWaterMark?: number }): FileSink;
  exists(): Promise<boolean>;
}

export interface FileSink {
  write(chunk: string | ArrayBufferView | ArrayBuffer | SharedArrayBuffer): number;
  flush(): number | Promise<number>;
  end(error?: Error): number | Promise<number>;
  start(options?: { highWaterMark?: number }): void;
  ref(): void;
  unref(): void;
}
```
