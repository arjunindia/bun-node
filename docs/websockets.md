# Bun WebSockets

## Overview

Bun's `Bun.serve()` supports server-side WebSockets featuring on-the-fly compression, TLS support, and a native publish-subscribe API. Internally, the implementation is built on [uWebSockets](https://github.com/uNetworking/uWebSockets).

### Performance

For a simple chatroom benchmark on Linux x64 with 16 clients:

| Runtime | Messages/sec |
|---|---|
| Bun v0.2.1 (`Bun.serve`) | ~700,000 |
| Node v18.10.0 (`ws`) | ~100,000 |

## Starting a WebSocket Server

```ts
Bun.serve({
  fetch(req, server) {
    if (server.upgrade(req)) {
      return; // do not return a Response
    }
    return new Response("Upgrade failed", { status: 500 });
  },
  websocket: {},
});
```

### Supported WebSocket Event Handlers

```ts
Bun.serve({
  fetch(req, server) {},
  websocket: {
    message(ws, message) {},
    open(ws) {},
    close(ws, code, message) {},
    drain(ws) {},
  },
});
```

- **`message`** — triggered when a message is received
- **`open`** — triggered when a socket is opened
- **`close`** — triggered when a socket is closed
- **`drain`** — triggered when the socket is ready to receive more data

### Design Rationale (Speed)

Handlers in Bun are declared once per server rather than per socket. The `ServerWebSocket` approach uses a single handler object reused across all connections, which reduces memory usage and avoids overhead from adding/removing event listeners on each connection.

### Sending Messages

```ts
ws.send("Hello world");               // string
ws.send(response.arrayBuffer());       // ArrayBuffer
ws.send(new Uint8Array([1, 2, 3]));    // TypedArray | DataView
```

### Headers on Upgrade

```ts
server.upgrade(req, {
  headers: {
    "Set-Cookie": `SessionId=${sessionId}`,
  },
});
```

### Contextual Data

```ts
type WebSocketData = {
  createdAt: number;
  channelId: string;
  authToken: string;
};

Bun.serve({
  fetch(req, server) {
    const cookies = new Bun.CookieMap(req.headers.get("cookie")!);
    server.upgrade(req, {
      data: {
        createdAt: Date.now(),
        channelId: new URL(req.url).searchParams.get("channelId"),
        authToken: cookies.get("X-Token"),
      },
    });
    return undefined;
  },
  websocket: {
    data: {} as WebSocketData,
    async message(ws, message) {
      const user = getUserFromToken(ws.data.authToken);
      await saveMessageToDatabase({
        channel: ws.data.channelId,
        message: String(message),
        userId: user.id,
      });
    },
  },
});
```

### Connecting from the Browser

```js
const socket = new WebSocket("ws://localhost:3000/chat");
socket.addEventListener("message", event => {
  console.log(event.data);
});
```

## Pub/Sub

Bun's `ServerWebSocket` implements a native publish-subscribe API for topic-based broadcasting. Sockets can `.subscribe()` to a topic and `.publish()` messages to all other subscribers (excluding itself).

```ts
const server = Bun.serve({
  fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname === "/chat") {
      const username = getUsernameFromReq(req);
      const success = server.upgrade(req, { data: { username } });
      return success ? undefined : new Response("WebSocket upgrade error", { status: 400 });
    }
    return new Response("Hello world");
  },
  websocket: {
    data: {} as { username: string },
    open(ws) {
      const msg = `${ws.data.username} has entered the chat`;
      ws.subscribe("the-group-chat");
      server.publish("the-group-chat", msg);
    },
    message(ws, message) {
      server.publish("the-group-chat", `${ws.data.username}: ${message}`);
      console.log(ws.subscriptions); // ["the-group-chat"]
    },
    close(ws) {
      const msg = `${ws.data.username} has left the chat`;
      ws.unsubscribe("the-group-chat");
      server.publish("the-group-chat", msg);
    },
  },
});
```

`.publish(data)` on a socket sends to all subscribers *except* the caller. To send to **all** subscribers including the caller, use `server.publish()`:

```ts
server.publish("the-group-chat", "Hello world");
```

## Compression

```ts
Bun.serve({
  websocket: {
    perMessageDeflate: true,
  },
});
```

Compression for individual messages can be toggled via the second argument to `.send()`:

```ts
ws.send("Hello world", true);
```

## Backpressure

`.send(message)` returns a `number`:
- **`-1`** — Message enqueued but there is backpressure
- **`0`** — Message dropped due to a connection issue
- **`1+`** — Number of bytes sent

## Timeouts and Limits

### Idle Timeout

Default: 120 seconds. Configurable via `idleTimeout`:

```ts
Bun.serve({
  websocket: {
    idleTimeout: 60,
  },
});
```

### Max Payload Length

Default: 16 MB. Configurable via `maxPayloadLength`:

```ts
Bun.serve({
  websocket: {
    maxPayloadLength: 1024 * 1024, // 1 MB
  },
});
```

## Connecting to a WebSocket Server (Client)

```ts
const socket = new WebSocket("ws://localhost:3000");

// With subprotocol negotiation
const socket2 = new WebSocket("ws://localhost:3000", ["soap", "wamp"]);
```

Bun-specific extension: custom headers in the constructor (not supported in browsers):

```ts
const socket = new WebSocket("ws://localhost:3000", {
  headers: { /* custom headers */ },
});
```

### Client Event Listeners

```ts
socket.addEventListener("message", event => {});
socket.addEventListener("open", event => {});
socket.addEventListener("close", event => {});
socket.addEventListener("error", event => {});
```

## Reference

### `Bun.serve()` WebSocket Options

| Parameter | Type | Default | Description |
|---|---|---|---|
| `message` | `(ws, message) => void` | required | Handler for incoming messages |
| `open` | `(ws) => void` | — | Handler for socket open |
| `close` | `(ws, code, reason) => void` | — | Handler for socket close |
| `error` | `(ws, error) => void` | — | Handler for errors |
| `drain` | `(ws) => void` | — | Handler when ready for more data |
| `maxPayloadLength` | `number` | 16 MB | Max incoming message size |
| `idleTimeout` | `number` | 120 (seconds) | Idle connection timeout |
| `backpressureLimit` | `number` | 1 MB | Backpressure threshold |
| `closeOnBackpressureLimit` | `boolean` | `false` | Close when backpressure limit hit |
| `sendPings` | `boolean` | `true` | Whether to send pings |
| `publishToSelf` | `boolean` | `false` | Whether publish includes self |
| `perMessageDeflate` | `boolean` or object | — | Compression settings |

### `perMessageDeflate` Object Form

```ts
perMessageDeflate?: boolean | {
  compress?: boolean | Compressor;
  decompress?: boolean | Compressor;
};
```

**`Compressor` type values:** `"disable"`, `"shared"`, `"dedicated"`, `"3KB"`, `"4KB"`, `"8KB"`, `"16KB"`, `"32KB"`, `"64KB"`, `"128KB"`, `"256KB"`

### `Server` Interface

| Property/Method | Description |
|---|---|
| `pendingWebSockets: number` | Count of pending WebSocket connections |
| `publish(topic, data, compress?)` | Publish to all subscribers of a topic |
| `upgrade(req, options?)` | Upgrade a request to WebSocket; returns `boolean` |

### `ServerWebSocket` Interface

| Property/Method | Description |
|---|---|
| `data: any` | Contextual data attached at upgrade |
| `readyState: number` | Current connection state |
| `remoteAddress: string` | Client's remote address |
| `subscriptions: string[]` | Currently subscribed topics |
| `send(message, compress?)` | Send message; returns number indicating result |
| `close(code?, reason?)` | Close the connection |
| `subscribe(topic)` | Subscribe to a topic |
| `unsubscribe(topic)` | Unsubscribe from a topic |
| `publish(topic, message)` | Publish to other subscribers of topic |
| `isSubscribed(topic)` | Check subscription status |
| `cork(cb)` | Batch writes within callback |
