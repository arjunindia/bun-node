# DNS

Use Bun's DNS module to resolve DNS records.

Bun provides its own `dns` module alongside the `node:dns` compatibility module.

```ts
import * as dns from "node:dns";

const addrs = await dns.promises.resolve4("bun.com", { ttl: true });
console.log(addrs);
// => [{ address: "172.67.161.226", family: 4, ttl: 0 }, ...]
```

```ts
import { dns } from "bun";

dns.prefetch("bun.com", 443);
```

---

## DNS Caching in Bun

Bun includes built-in DNS caching that speeds up repeated connections to the same hosts.

The cache holds up to 255 entries, each with a maximum TTL of 30 seconds. Failed connections cause the corresponding entry to be evicted. When multiple simultaneous connections target the same host, DNS lookups are deduplicated to prevent redundant requests.

The following APIs automatically leverage the DNS cache:

- `bun install`
- `fetch()`
- `node:http` (client)
- `Bun.connect`
- `node:net`
- `node:tls`

---

## When Should I Prefetch a DNS Entry?

Web browsers offer `<link rel="dns-prefetch">` to let developers resolve hostnames ahead of time, avoiding latency on the initial lookup.

Bun provides an equivalent through the `dns.prefetch` API. A practical use case involves database drivers: at application startup, you can prefetch the database host's DNS entry so the resolution is likely complete by the time the app finishes initializing.

```ts
import { dns } from "bun";

dns.prefetch("my.database-host.com", 5432);
```

---

## `dns.prefetch`

Prefetches a DNS entry for a hostname and port, useful when a connection to that host is anticipated soon.

**Signature:**

```ts
dns.prefetch(hostname: string, port: number): void;
```

**Example:**

```ts
import { dns } from "bun";

dns.prefetch("bun.com", 443);
// ... sometime later ...
await fetch("https://bun.com");
```

---

## `dns.getCacheStats()`

Returns an object describing the current state of the DNS cache.

**Returned object properties:**

| Property | Type | Description |
|---|---|---|
| `cacheHitsCompleted` | `number` | Cache hits completed |
| `cacheHitsInflight` | `number` | Cache hits still in flight |
| `cacheMisses` | `number` | Cache misses |
| `size` | `number` | Number of items currently in the DNS cache |
| `errors` | `number` | Number of times a connection failed |
| `totalCount` | `number` | Total connection requests (including both hits and misses) |

**Example:**

```ts
import { dns } from "bun";

const stats = dns.getCacheStats();
console.log(stats);
// => { cacheHitsCompleted: 0, cacheHitsInflight: 0, cacheMisses: 0, size: 0, errors: 0, totalCount: 0 }
```

---

## Configuring DNS Cache TTL

The default TTL for DNS cache entries is 30 seconds. Override this by setting the environment variable `BUN_CONFIG_DNS_TIME_TO_LIVE_SECONDS`.

**Example — setting TTL to 5 seconds:**

```sh
BUN_CONFIG_DNS_TIME_TO_LIVE_SECONDS=5 bun run my-script.ts
```

### Why 30 Seconds?

The underlying system API (`getaddrinfo`) exposes no mechanism to read a DNS entry's actual TTL, so an arbitrary value must be chosen. Thirty seconds was selected because it's long enough to benefit from caching while short enough to minimize stale-record issues. For reference, Amazon Web Services recommends 5 seconds for JVM-based applications, though the JVM defaults to caching indefinitely.
