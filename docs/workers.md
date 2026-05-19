# Bun Workers

Bun's Workers API enables creating and communicating with JavaScript instances on separate threads while sharing I/O resources with the main thread.

> **Warning:** The `Worker` API remains experimental, especially regarding worker termination. Active improvements are ongoing.

## Overview

Bun implements a minimal version of the Web Workers API with server-side extensions. Workers in Bun support CommonJS, ES Modules, TypeScript, JSX, TSX, and more out of the box without extra build steps.

## Creating a Worker

`Worker` is a global, just like in browsers.

### From the Main Thread

```ts
// index.ts
const worker = new Worker("./worker.ts");

worker.postMessage("hello");
worker.onmessage = event => {
  console.log(event.data);
};
```

### Worker Thread

```ts
// worker.ts
declare var self: Worker;

self.onmessage = (event: MessageEvent) => {
  console.log(event.data);
  postMessage("world");
};
```

To avoid TypeScript errors when referencing `self`, add `declare var self: Worker;` at the top of the worker file.

Workers support `import` and `export` syntax. Unlike browsers, there's no need to specify `{type: "module"}` for ES Modules.

The script path is resolved when `new Worker(url)` is called, simplifying error handling. Attempting to load a non-existent file throws immediately:

```js
const worker = new Worker("/not-found.js");
// throws an error immediately
```

The specifier is resolved relative to the project root, equivalent to running `bun ./path/to/file.js`.

### `preload` — Loading Modules Before Worker Start

Pass an array (or single string) of module specifiers to `preload` to load code before the worker begins:

```ts
// index.ts
const worker = new Worker("./worker.ts", {
  preload: ["./load-sentry.js"],
});
```

A single string also works:

```ts
const worker = new Worker("./worker.ts", {
  preload: "./load-sentry.js",
});
```

### `blob:` URLs

Workers can be created from `blob:` URLs:

```js
const blob = new Blob(
  [`self.onmessage = (event: MessageEvent) => postMessage(event.data)`],
  { type: "application/typescript" }
);
const url = URL.createObjectURL(blob);
const worker = new Worker(url);
```

Workers from `blob:` URLs support TypeScript, JSX, and other file types:

```ts
const file = new File(
  [`self.onmessage = (event: MessageEvent) => postMessage(event.data)`],
  "worker.ts"
);
const url = URL.createObjectURL(file);
const worker = new Worker(url);
```

### `"open"` Event

Emitted when a worker is created and ready to receive messages. This is a Bun-specific event (not in browsers).

```ts
const worker = new Worker(new URL("worker.ts", import.meta.url).href);

worker.addEventListener("open", () => {
  console.log("worker is ready");
});
```

Messages are automatically enqueued until the worker is ready, so waiting for `"open"` is not required before sending.

## Messages with `postMessage`

Use `worker.postMessage` (main thread) and `self.postMessage` (worker thread) to send messages. This leverages the HTML Structured Clone Algorithm.

### Performance Optimizations

Bun includes optimized fast paths for `postMessage`:

- **String fast path:** Pure string values bypass the structured clone algorithm entirely.
- **Simple object fast path:** Plain objects containing only primitive values (strings, numbers, booleans, null, undefined) use an optimized serialization path.

These fast paths yield **2-241x faster** `postMessage` performance.

**Examples of each path:**

```js
// String fast path - optimized
postMessage("Hello, worker!");

// Simple object fast path - optimized
postMessage({
  message: "Hello",
  count: 42,
  enabled: true,
  data: null,
});

// Complex objects still work but use standard structured clone
postMessage({
  nested: { deep: { object: true } },
  date: new Date(),
  buffer: new ArrayBuffer(8),
});
```

**Routing behavior:**

```js
// On the worker thread, postMessage is automatically "routed" to the parent thread.
postMessage({ hello: "world" });

// On the main thread
worker.postMessage({ hello: "world" });
```

**Receiving messages:**

```js
// Worker thread:
self.addEventListener("message", event => {
  console.log(event.data);
});

// Main thread:
worker.addEventListener("message", event => {
  console.log(event.data);
});
```

## Terminating a Worker

A `Worker` terminates automatically when its event loop has no remaining work. For forceful termination:

```ts
const worker = new Worker(new URL("worker.ts", import.meta.url).href);

// ...some time later
worker.terminate();
```

### `process.exit()`

A worker can call `process.exit()` to terminate itself without affecting the main process.

### `"close"` Event

Emitted when a worker has been terminated. The `CloseEvent` contains the exit code from `process.exit()`, or 0 if closed for other reasons. This is a Bun-specific event (not in browsers).

```ts
const worker = new Worker(new URL("worker.ts", import.meta.url).href);

worker.addEventListener("close", event => {
  console.log("worker is being closed");
});
```

## Managing Lifetime

By default, an active `Worker` keeps the spawning process alive.

### `worker.unref()`

Call `worker.unref()` to decouple the worker's lifetime from the main process:

```ts
const worker = new Worker(new URL("worker.ts", import.meta.url).href);
worker.unref();
```

### `worker.ref()`

Call `worker.ref()` to keep the process alive until the worker terminates:

```ts
const worker = new Worker(new URL("worker.ts", import.meta.url).href);
worker.unref();
// later...
worker.ref();
```

Alternatively, pass `ref: false` in the options:

```ts
const worker = new Worker(new URL("worker.ts", import.meta.url).href, {
  ref: false,
});
```

## Memory Usage with `smol`

Bun's `Worker` supports a `smol` mode that reduces memory usage at a cost to performance:

```ts
const worker = new Worker("./i-am-smol.ts", {
  smol: true,
});
```

Setting `smol: true` changes `JSC::HeapSize` from the default `Large` to `Small`.

## Environment Data

Share data between the main thread and workers using `setEnvironmentData()` and `getEnvironmentData()` from `worker_threads`:

```ts
import { setEnvironmentData, getEnvironmentData } from "worker_threads";

// In main thread
setEnvironmentData("config", { apiUrl: "https://api.example.com" });

// In worker
const config = getEnvironmentData("config");
console.log(config); // => { apiUrl: "https://api.example.com" }
```

## Worker Events

Listen for worker creation events using `process.emit()`:

```ts
process.on("worker", worker => {
  console.log("New worker created:", worker.threadId);
});
```

## `Bun.isMainThread`

Check whether code is running in the main thread:

```ts
if (Bun.isMainThread) {
  console.log("I'm the main thread");
} else {
  console.log("I'm in a worker");
}
```
