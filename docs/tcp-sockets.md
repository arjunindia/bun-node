# Bun TCP Sockets

## Overview

Bun provides a native TCP API for building performance-sensitive systems such as database clients, game servers, and other TCP-based communication tools. This is a low-level API intended for library authors and for advanced use cases.

## Starting a TCP Server (`Bun.listen()`)

A TCP server is created using `Bun.listen()` with a configuration object specifying `hostname`, `port`, and a `socket` object containing event handlers.

### Configuration Parameters

| Parameter | Description |
|-----------|-------------|
| `hostname` | The address to bind to (e.g., `"localhost"`) |
| `port` | The port number (e.g., `8080`) |
| `socket` | Object containing event handler callbacks |
| `tls` | Optional TLS configuration object |

### Socket Event Handlers (Server)

| Handler | Signature | Description |
|---------|-----------|-------------|
| `data` | `(socket, data)` | Message received from client |
| `open` | `(socket)` | Socket opened |
| `close` | `(socket, error)` | Socket closed |
| `drain` | `(socket)` | Socket ready for more data |
| `error` | `(socket, error)` | Error handler |

### Basic Server Example

```ts
Bun.listen({
  hostname: "localhost",
  port: 8080,
  socket: {
    data(socket, data) {},
    open(socket) {},
    close(socket, error) {},
    drain(socket) {},
    error(socket, error) {},
  },
});
```

### Design Rationale for Speed

Handlers are declared once per server rather than assigning callbacks to individual sockets. This differs from Node.js `EventEmitters` or the web-standard `WebSocket` API. Assigning listeners to each socket can cause significant garbage collector pressure and increase memory usage. Bun only allocates one handler function for each event and shares it among all sockets.

### Attaching Contextual Data with Generics

```ts
type SocketData = { sessionId: string };

Bun.listen<SocketData>({
  hostname: "localhost",
  port: 8080,
  socket: {
    data(socket, data) {
      socket.write(`${socket.data.sessionId}: ack`);
    },
    open(socket) {
      socket.data = { sessionId: "abcd" };
    },
  },
});
```

### TLS Configuration

```ts
Bun.listen({
  hostname: "localhost",
  port: 8080,
  socket: {
    data(socket, data) {},
  },
  tls: {
    key: Bun.file("./key.pem"),
    cert: Bun.file("./cert.pem"),
  },
});
```

Accepted key/cert formats:

```ts
key: Bun.file("./key.pem"),                           // BunFile
key: fs.readFileSync("./key.pem"),                     // Buffer
key: fs.readFileSync("./key.pem", "utf8"),             // string
key: [Bun.file("./key1.pem"), Bun.file("./key2.pem")], // array of above
```

### Server Return Value

`Bun.listen` returns a `TCPSocket`-conforming server object with:
- **`server.stop(true)`** — Stops the server; the boolean determines whether active connections are forcibly closed.
- **`server.unref()`** — Allows the Bun process to exit even while the server is still listening.

## Creating a TCP Client Connection (`Bun.connect()`)

`Bun.connect()` establishes a connection to a TCP server.

### Configuration Parameters

| Parameter | Description |
|-----------|-------------|
| `hostname` | The server address to connect to |
| `port` | The server port |
| `socket` | Object containing event handler callbacks |
| `tls` | Set to `true` to require TLS |

### Socket Event Handlers (Client)

All server handlers apply, plus these client-specific ones:

| Handler | Signature | Description |
|---------|-----------|-------------|
| `connectError` | `(socket, error)` | Connection failed |
| `end` | `(socket)` | Connection closed by server |
| `timeout` | `(socket)` | Connection timed out |

### Client Example

```ts
const socket = await Bun.connect({
  hostname: "localhost",
  port: 8080,
  socket: {
    data(socket, data) {},
    open(socket) {},
    close(socket, error) {},
    drain(socket) {},
    error(socket, error) {},
    connectError(socket, error) {},
    end(socket) {},
    timeout(socket) {},
  },
});
```

To require TLS on the client side:

```ts
const socket = await Bun.connect({
  // ... config
  tls: true,
});
```

## Hot Reloading

Both TCP servers and client sockets support hot reloading with new handler implementations.

### Server Reload

```ts
const server = Bun.listen({ /* config */ });

server.reload({
  socket: {
    data() {
      // new 'data' handler
    },
  },
});
```

### Client Socket Reload

```ts
const socket = await Bun.connect({ /* config */ });

socket.reload({
  data() {
    // new 'data' handler
  },
});
```

## Buffering

Currently, TCP sockets in Bun do not buffer data. For performance-sensitive code, buffering strategy matters significantly.

### Performance Impact of Multiple Writes

```ts
// Poor performance:
socket.write("h");
socket.write("e");
socket.write("l");
socket.write("l");
socket.write("o");

// Better performance:
socket.write("hello");
```

### Using `ArrayBufferSink` for Buffering

```ts
import { ArrayBufferSink } from "bun";

const sink = new ArrayBufferSink();
sink.start({
  stream: true,
  highWaterMark: 1024,
});

sink.write("h");
sink.write("e");
sink.write("l");
sink.write("l");
sink.write("o");

queueMicrotask(() => {
  const data = sink.flush();
  const wrote = socket.write(data);
  if (wrote < data.byteLength) {
    sink.write(data.subarray(wrote));
  }
});
```

### Note on Corking

Support for corking is planned, but in the meantime backpressure must be managed manually with the `drain` handler.
