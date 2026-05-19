# Bun HTTP Server

> Use `Bun.serve` to start a high-performance HTTP server in Bun

## Basic Setup

```ts
const server = Bun.serve({
  // `routes` requires Bun v1.2.3+
  routes: {
    // Static routes
    "/api/status": new Response("OK"),

    // Dynamic routes
    "/users/:id": req => {
      return new Response(`Hello User ${req.params.id}!`);
    },

    // Per-HTTP method handlers
    "/api/posts": {
      GET: () => new Response("List posts"),
      POST: async req => {
        const body = await req.json();
        return Response.json({ created: true, ...body });
      },
    },

    // Wildcard route for all routes that start with "/api/" and aren't otherwise matched
    "/api/*": Response.json({ message: "Not found" }, { status: 404 }),

    // Redirect from /blog/hello to /blog/hello/world
    "/blog/hello": Response.redirect("/blog/hello/world"),

    // Serve a file by lazily loading it into memory
    "/favicon.ico": Bun.file("./favicon.ico"),
  },

  // (optional) fallback for unmatched routes:
  // Required if Bun's version < 1.2.3
  fetch(req) {
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Server running at ${server.url}`);
```

## HTML imports

Bun supports importing HTML files directly into your server code, enabling full-stack applications with both server-side and client-side code. HTML imports work in two modes:

**Development (`bun --hot`):** Assets are bundled on-demand at runtime, enabling hot module replacement (HMR) for a fast, iterative development experience. When you change your frontend code, the browser automatically updates without a full page reload.

**Production (`bun build`):** When building with `bun build --target=bun`, the `import index from "./index.html"` statement resolves to a pre-built manifest object containing all bundled client assets. `Bun.serve` consumes this manifest to serve optimized assets with zero runtime bundling overhead. This is ideal for deploying to production.

```ts
import myReactSinglePageApp from "./index.html";

Bun.serve({
  routes: {
    "/": myReactSinglePageApp,
  },
});
```

HTML imports don't just serve HTML — it's a full-featured frontend bundler, transpiler, and toolkit built using Bun's bundler, JavaScript transpiler and CSS parser. You can use this to build full-featured frontends with React, TypeScript, Tailwind CSS, and more.

## Configuration

### Changing the `port` and `hostname`

```ts
Bun.serve({
  port: 8080, // defaults to $BUN_PORT, $PORT, $NODE_PORT otherwise 3000
  hostname: "mydomain.com", // defaults to "0.0.0.0"
  fetch(req) {
    return new Response("404!");
  },
});
```

To randomly select an available port, set `port` to `0`.

```ts
const server = Bun.serve({
  port: 0, // random port
  fetch(req) {
    return new Response("404!");
  },
});

console.log(server.port); // randomly selected port
```

You can view the chosen port by accessing the `port` property on the server object, or by accessing the `url` property.

```ts
console.log(server.port); // 3000
console.log(server.url); // http://localhost:3000
```

### Configuring a default port

Bun supports several options and environment variables to configure the default port:

- `--port` CLI flag: `bun --port=4002 server.ts`
- `BUN_PORT` environment variable: `BUN_PORT=4002 bun server.ts`
- `PORT` environment variable: `PORT=4002 bun server.ts`
- `NODE_PORT` environment variable: `NODE_PORT=4002 bun server.ts`

## Unix domain sockets

```ts
Bun.serve({
  unix: "/tmp/my-socket.sock",
  fetch(req) {
    return new Response("404!");
  },
});
```

### Abstract namespace sockets

Bun supports Linux abstract namespace sockets. Prefix the `unix` path with a null byte:

```ts
Bun.serve({
  unix: "\0my-abstract-socket",
  fetch(req) {
    return new Response("404!");
  },
});
```

Unlike unix domain sockets, abstract namespace sockets are not bound to the filesystem and are automatically removed when the last reference to the socket is closed.

## HTTP/3 (QUIC)

> HTTP/3 support in `Bun.serve` is **experimental** and may change in future releases.

```ts
Bun.serve({
  tls: {
    key: Bun.file("./key.pem"),
    cert: Bun.file("./cert.pem"),
  },
  http3: true,
  fetch(req) {
    return new Response("Hello over HTTP/3!");
  },
});
```

When `http3` is enabled, the server listens on the same port over both TCP (HTTP/1.1) and UDP (HTTP/3). HTTP/1.1 responses include an `Alt-Svc` header advertising the HTTP/3 endpoint so capable clients can upgrade automatically.

To serve HTTP/3 only — no TCP listener at all — set `http1: false`:

```ts
Bun.serve({
  tls: {
    key: Bun.file("./key.pem"),
    cert: Bun.file("./cert.pem"),
  },
  http3: true,
  http1: false,
  fetch(req) {
    return new Response("HTTP/3 only");
  },
});
```

> `http3` is not supported with unix domain sockets — QUIC requires a UDP port. `http1: false` requires `http3: true`.

## idleTimeout

By default, `Bun.serve` closes connections after **10 seconds** of inactivity. A connection is considered idle when there is no data being sent or received. The maximum value is `255`, and `0` disables the timeout entirely.

```ts
Bun.serve({
  idleTimeout: 30, // 30 seconds (default is 10)
  fetch(req) {
    return new Response("Bun!");
  },
});
```

> **Streaming & Server-Sent Events** — The idle timer applies while a response is being streamed. If your stream goes quiet for longer than `idleTimeout`, the connection will be closed mid-response. For long-lived streams, disable the timeout for that request with `server.timeout(req, 0)`.

## export default syntax

```ts
import type { Serve } from "bun";

export default {
  fetch(req) {
    return new Response("Bun!");
  },
} satisfies Serve.Options<undefined>;
```

Instead of passing the server options into `Bun.serve`, `export default` it. This file can be executed as-is; when Bun sees a file with a `default` export containing a `fetch` handler, it passes it into `Bun.serve` under the hood.

## Hot Route Reloading

Update routes without server restarts using `server.reload()`:

```ts
const server = Bun.serve({
  routes: {
    "/api/version": () => Response.json({ version: "1.0.0" }),
  },
});

server.reload({
  routes: {
    "/api/version": () => Response.json({ version: "2.0.0" }),
  },
});
```

## Server Lifecycle Methods

### `server.stop()`

```ts
const server = Bun.serve({
  fetch(req) {
    return new Response("Hello!");
  },
});

// Gracefully stop the server (waits for in-flight requests)
await server.stop();

// Force stop and close all active connections
await server.stop(true);
```

### `server.ref()` and `server.unref()`

```ts
server.unref(); // Don't keep process alive if server is the only thing running
server.ref();   // Restore default behavior - keep process alive
```

### `server.reload()`

```ts
const server = Bun.serve({
  routes: { "/api/version": Response.json({ version: "v1" }) },
  fetch(req) { return new Response("v1"); },
});

server.reload({
  routes: { "/api/version": Response.json({ version: "v2" }) },
  fetch(req) { return new Response("v2"); },
});
```

Only `fetch`, `error`, and `routes` can be updated.

## Per-Request Controls

### `server.timeout(Request, seconds)`

```ts
const server = Bun.serve({
  async fetch(req, server) {
    server.timeout(req, 60); // 60 seconds instead of default 10
    await req.text();
    return new Response("Done!");
  },
});
```

For long-lived streaming responses (like Server-Sent Events):

```ts
Bun.serve({
  routes: {
    "/events": (req, server) => {
      server.timeout(req, 0); // Disable timeout for streaming response
      return new Response(
        async function* () {
          yield "data: hello\n\n";
        },
        { headers: { "Content-Type": "text/event-stream" } },
      );
    },
  },
});
```

### `server.requestIP(Request)`

```ts
const server = Bun.serve({
  fetch(req, server) {
    const address = server.requestIP(req);
    if (address) {
      return new Response(`Client IP: ${address.address}, Port: ${address.port}`);
    }
    return new Response("Unknown client");
  },
});
```

## Server Metrics

### `server.pendingRequests` and `server.pendingWebSockets`

```ts
const server = Bun.serve({
  fetch(req, server) {
    return new Response(
      `Active requests: ${server.pendingRequests}\nActive WebSockets: ${server.pendingWebSockets}`,
    );
  },
});
```

### `server.subscriberCount(topic)`

```ts
const server = Bun.serve({
  fetch(req, server) {
    const chatUsers = server.subscriberCount("chat");
    return new Response(`${chatUsers} users in chat`);
  },
  websocket: {
    message(ws) {
      ws.subscribe("chat");
    },
  },
});
```

## Benchmarks

| Runtime | Requests per second |
| ------- | ------------------- |
| Node 16 | ~64,000 |
| Bun | ~160,000 |

The `Bun.serve` server can handle roughly 2.5x more requests per second than Node.js on Linux.

## Reference

```ts
interface Server extends Disposable {
  stop(closeActiveConnections?: boolean): Promise<void>;
  reload(options: Serve): void;
  fetch(request: Request | string): Response | Promise<Response>;
  upgrade<T = undefined>(request: Request, options?: { headers?: Bun.HeadersInit; data?: T }): boolean;
  publish(topic: string, data: string | ArrayBufferView | ArrayBuffer | SharedArrayBuffer, compress?: boolean): ServerWebSocketSendStatus;
  subscriberCount(topic: string): number;
  requestIP(request: Request): SocketAddress | null;
  timeout(request: Request, seconds: number): void;
  ref(): void;
  unref(): void;

  readonly pendingRequests: number;
  readonly pendingWebSockets: number;
  readonly url: URL;
  readonly port: number;
  readonly hostname: string;
  readonly development: boolean;
  readonly id: string;
}
```
