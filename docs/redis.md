# Redis

> Use Bun's native Redis client with a Promise-based API

Bun's Redis client supports Redis server versions 7.2 and up.

Bun provides native bindings for working with Redis databases with a modern, Promise-based API. The interface is designed to be performant, with built-in connection management, fully typed responses, and TLS support.

```ts
import { redis } from "bun";

// Set a key
await redis.set("greeting", "Hello from Bun!");

// Get a key
const greeting = await redis.get("greeting");
console.log(greeting); // "Hello from Bun!"

// Increment a counter
await redis.set("counter", 0);
await redis.incr("counter");

// Check if a key exists
const exists = await redis.exists("greeting");

// Delete a key
await redis.del("greeting");
```

---

## Getting Started

To use the Redis client, you first need to create a connection:

```ts
import { redis, RedisClient } from "bun";

// Using the default client (reads connection info from environment)
// process.env.REDIS_URL is used by default
await redis.set("hello", "world");
const result = await redis.get("hello");

// Creating a custom client
const client = new RedisClient("redis://username:password@localhost:6379");
await client.set("counter", "0");
await client.incr("counter");
```

By default, the client reads connection information from the following environment variables (in order of precedence):

* `REDIS_URL`
* `VALKEY_URL`
* If not set, defaults to `"redis://localhost:6379"`

### Connection Lifecycle

The Redis client automatically handles connections in the background:

```ts
// No connection is made until a command is executed
const client = new RedisClient();

// First command initiates the connection
await client.set("key", "value");

// Connection remains open for subsequent commands
await client.get("key");

// Explicitly close the connection when done
client.close();
```

You can also manually control the connection lifecycle:

```ts
const client = new RedisClient();

// Explicitly connect
await client.connect();

// Run commands
await client.set("key", "value");

// Disconnect when done
client.close();
```

---

## Basic Operations

### String Operations

```ts
// Set a key
await redis.set("user:1:name", "Alice");

// Get a key
const name = await redis.get("user:1:name");

// Get a key as Uint8Array
const buffer = await redis.getBuffer("user:1:name");

// Delete a key
await redis.del("user:1:name");

// Check if a key exists
const exists = await redis.exists("user:1:name");

// Set expiration (in seconds)
await redis.set("session:123", "active");
await redis.expire("session:123", 3600); // expires in 1 hour

// Get time to live (in seconds)
const ttl = await redis.ttl("session:123");
```

### Numeric Operations

```ts
// Set initial value
await redis.set("counter", "0");

// Increment by 1
await redis.incr("counter");

// Decrement by 1
await redis.decr("counter");
```

### Hash Operations

```ts
// Set multiple fields in a hash
await redis.hmset("user:123", ["name", "Alice", "email", "alice@example.com", "active", "true"]);

// Get multiple fields from a hash
const userFields = await redis.hmget("user:123", ["name", "email"]);
console.log(userFields); // ["Alice", "alice@example.com"]

// Get single field from hash (returns value directly, null if missing)
const userName = await redis.hget("user:123", "name");
console.log(userName); // "Alice"

// Increment a numeric field in a hash
await redis.hincrby("user:123", "visits", 1);

// Increment a float field in a hash
await redis.hincrbyfloat("user:123", "score", 1.5);
```

### Set Operations

```ts
// Add member to set
await redis.sadd("tags", "javascript");

// Remove member from set
await redis.srem("tags", "javascript");

// Check if member exists in set
const isMember = await redis.sismember("tags", "javascript");

// Get all members of a set
const allTags = await redis.smembers("tags");

// Get a random member
const randomTag = await redis.srandmember("tags");

// Pop (remove and return) a random member
const poppedTag = await redis.spop("tags");
```

---

## Pub/Sub

Bun provides native bindings for the Redis Pub/Sub protocol.

### Basic Usage

**Publisher:**

```ts
import { RedisClient } from "bun";

const writer = new RedisClient("redis://localhost:6379");
await writer.connect();

writer.publish("general", "Hello everyone!");

writer.close();
```

**Subscriber:**

```ts
import { RedisClient } from "bun";

const listener = new RedisClient("redis://localhost:6379");
await listener.connect();

await listener.subscribe("general", (message, channel) => {
  console.log(`Received: ${message}`);
});
```

> **Note:** The subscription mode takes over the `RedisClient` connection. A client with subscriptions can only call `RedisClient.prototype.subscribe()`. Applications which need to message Redis need a separate connection, acquirable through `.duplicate()`:

```ts
import { RedisClient } from "bun";

const redis = new RedisClient("redis://localhost:6379");
await redis.connect();
const subscriber = await redis.duplicate();

await subscriber.subscribe("foo", () => {});
await redis.set("bar", "baz");
```

### Publishing

```ts
await client.publish(channelName, message);
```

### Subscriptions

```ts
await client.subscribe(channel, (message, channel) => {});
```

You can unsubscribe:

```ts
await client.unsubscribe(); // Unsubscribe from all channels.
await client.unsubscribe(channel); // Unsubscribe a particular channel.
await client.unsubscribe(channel, listener); // Unsubscribe a particular listener.
```

---

## Advanced Usage

### Command Execution and Pipelining

The client automatically pipelines commands, improving performance:

```ts
const [infoResult, listResult] = await Promise.all([
  redis.get("user:1:name"),
  redis.get("user:2:email"),
]);
```

To disable automatic pipelining:

```ts
const client = new RedisClient("redis://localhost:6379", {
  enableAutoPipelining: false,
});
```

### Raw Commands

Use the `send` method for commands without convenience methods:

```ts
// Run any Redis command
const info = await redis.send("INFO", []);

// LPUSH to a list
await redis.send("LPUSH", ["mylist", "value1", "value2"]);

// Get list range
const list = await redis.send("LRANGE", ["mylist", "0", "-1"]);
```

### Connection Events

```ts
const client = new RedisClient();

client.onconnect = () => {
  console.log("Connected to Redis server");
};

client.onclose = error => {
  console.error("Disconnected from Redis server:", error);
};

await client.connect();
client.close();
```

### Connection Status and Monitoring

```ts
console.log(client.connected); // boolean indicating connection status
console.log(client.bufferedAmount); // bytes buffered
```

---

## Connection Options

```ts
const client = new RedisClient("redis://localhost:6379", {
  connectionTimeout: 5000, // Connection timeout in ms (default: 10000)
  idleTimeout: 30000, // Idle timeout in ms (default: 0 = no timeout)
  autoReconnect: true, // Auto reconnect on disconnection (default: true)
  maxRetries: 10, // Max reconnection attempts (default: 10)
  enableOfflineQueue: true, // Queue commands when disconnected (default: true)
  enableAutoPipelining: true, // Auto pipeline commands (default: true)
  tls: true, // TLS options (default: false)
});
```

### Reconnection Behavior

When a connection is lost, the client automatically attempts to reconnect with exponential backoff:

1. Starts with a small delay (50ms) and doubles it with each attempt
2. Reconnection delay is capped at 2000ms (2 seconds)
3. Attempts to reconnect up to `maxRetries` times (default: 10)
4. Commands executed during disconnection are queued if `enableOfflineQueue` is true

---

## Supported URL Formats

```ts
new RedisClient("redis://localhost:6379");
new RedisClient("redis://username:password@localhost:6379");
new RedisClient("redis://localhost:6379/0");
new RedisClient("rediss://localhost:6379"); // TLS
new RedisClient("redis+tls://localhost:6379"); // TLS
new RedisClient("redis+unix:///path/to/socket"); // Unix socket
new RedisClient("redis+tls+unix:///path/to/socket"); // TLS over Unix socket
```

---

## Error Handling

```ts
try {
  await redis.get("non-existent-key");
} catch (error) {
  if (error.code === "ERR_REDIS_CONNECTION_CLOSED") {
    console.error("Connection to Redis server was closed");
  } else if (error.code === "ERR_REDIS_AUTHENTICATION_FAILED") {
    console.error("Authentication failed");
  } else {
    console.error("Unexpected error:", error);
  }
}
```

Common error codes:

* `ERR_REDIS_CONNECTION_CLOSED` - Connection to the server was closed
* `ERR_REDIS_AUTHENTICATION_FAILED` - Failed to authenticate with the server
* `ERR_REDIS_INVALID_RESPONSE` - Received an invalid response from the server

---

## Example Use Cases

### Caching

```ts
async function getUserWithCache(userId) {
  const cacheKey = `user:${userId}`;

  const cachedUser = await redis.get(cacheKey);
  if (cachedUser) {
    return JSON.parse(cachedUser);
  }

  const user = await database.getUser(userId);

  await redis.set(cacheKey, JSON.stringify(user));
  await redis.expire(cacheKey, 3600);

  return user;
}
```

### Rate Limiting

```ts
async function rateLimit(ip, limit = 100, windowSecs = 3600) {
  const key = `ratelimit:${ip}`;

  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, windowSecs);
  }

  return {
    limited: count > limit,
    remaining: Math.max(0, limit - count),
  };
}
```

### Session Storage

```ts
async function createSession(userId, data) {
  const sessionId = crypto.randomUUID();
  const key = `session:${sessionId}`;

  await redis.hmset(key, [
    "userId", userId.toString(),
    "created", Date.now().toString(),
    "data", JSON.stringify(data),
  ]);
  await redis.expire(key, 86400); // 24 hours

  return sessionId;
}

async function getSession(sessionId) {
  const key = `session:${sessionId}`;

  const exists = await redis.exists(key);
  if (!exists) return null;

  const [userId, created, data] = await redis.hmget(key, ["userId", "created", "data"]);

  return {
    userId: Number(userId),
    created: Number(created),
    data: JSON.parse(data),
  };
}
```

---

## Implementation Notes

Bun's Redis client is implemented in Zig and uses the Redis Serialization Protocol (RESP3). It manages connections efficiently and provides automatic reconnection with exponential backoff.

The client supports pipelining commands, meaning multiple commands can be sent without waiting for the replies to previous commands.

## Limitations and Future Plans

Current limitations:

* Transactions (MULTI/EXEC) must be done through raw commands for now

Unsupported features:

* Redis Sentinel
* Redis Cluster
