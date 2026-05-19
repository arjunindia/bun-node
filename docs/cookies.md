# Bun Cookies

Bun offers built-in APIs for handling HTTP cookies via `Bun.Cookie` and `Bun.CookieMap`. These provide fast parsing, generation, and manipulation of cookies in HTTP requests and responses.

## CookieMap Class

`Bun.CookieMap` supplies a Map-like interface for managing cookie collections. It implements the `Iterable` interface, supporting `for...of` loops and related iteration methods.

### Construction

CookieMap can be instantiated in multiple ways:

- **Empty:** `new Bun.CookieMap()`
- **From a cookie string:** `new Bun.CookieMap("name=value; foo=bar")`
- **From an object:** passing a `Record<string, string>` like `{ session: "abc123", theme: "dark" }`
- **From an array of pairs:** e.g. `[["session", "abc123"], ["theme", "dark"]]`

### Usage in HTTP Servers

Within Bun's HTTP server (using `routes`), the request's `cookies` property is a `CookieMap` instance. You can call `.get()`, `.has()`, and `.set()` on it directly. When using `cookies.set()`, the cookie is automatically applied to the response — no manual header manipulation is needed.

### Methods

#### `get(name: string): string | null`

Returns the cookie value by name, or `null` if not found.

#### `has(name: string): boolean`

Returns `true` if a cookie with the specified name exists.

#### `set(...)` — Overloaded

Three signatures:
1. `set(name: string, value: string): void`
2. `set(options: CookieInit): void`
3. `set(cookie: Cookie): void`

Adds or updates a cookie. Defaults are `{ path: "/", sameSite: "lax" }`.

You can pass a name/value pair, a `CookieInit` options object (with fields like `maxAge`, `secure`, etc.), or a `Bun.Cookie` instance.

#### `delete(...)` — Overloaded

Two signatures:
1. `delete(name: string): void`
2. `delete(options: CookieStoreDeleteOptions): void`

Removes a cookie from the map. When applied to a Response, it adds a cookie with an empty string value and an expiry date in the past. A cookie will only delete successfully in the browser if the domain and path match those used when the cookie was originally created.

#### `toJSON(): Record<string, string>`

Converts the cookie map to a serializable key-value format.

#### `toSetCookieHeaders(): string[]`

Returns an array of `Set-Cookie` header values representing all cookie changes.

When using `Bun.serve()`, this is handled automatically. This method is primarily useful when working with other HTTP server implementations, such as Node's `http.createServer`, where you manually write response headers.

### Iteration

CookieMap supports multiple iteration patterns:

- **`for...of`** — iterates over `[name, value]` entries
- **`entries()`** — returns an `IterableIterator<[string, string]>`
- **`keys()`** — returns an `IterableIterator<string>` of cookie names
- **`values()`** — returns an `IterableIterator<string>` of cookie values
- **`forEach(callback)`** — invokes a callback with `(value, name)` for each cookie

### Properties

#### `size: number`

Returns the count of cookies in the map.

## Cookie Class

`Bun.Cookie` represents an individual HTTP cookie with its name, value, and attributes.

### Constructors

Four constructor signatures:

1. `new Bun.Cookie(name: string, value: string)` — basic
2. `new Bun.Cookie(name: string, value: string, options: CookieInit)` — with attributes
3. `new Bun.Cookie(cookieString: string)` — parse from a Set-Cookie-style string
4. `new Bun.Cookie(options: CookieInit)` — from an options object

### Properties

| Property | Type | Description |
|---|---|---|
| `name` | `string` | Cookie name (readonly) |
| `value` | `string` | Cookie value |
| `domain` | `string \| null` | Domain scope; null if unspecified |
| `path` | `string` | URL path scope (defaults to `"/"`) |
| `expires` | `number \| undefined` | Expiration timestamp in ms since epoch |
| `secure` | `boolean` | Whether HTTPS is required |
| `sameSite` | `"strict" \| "lax" \| "none"` | SameSite setting |
| `partitioned` | `boolean` | Whether the cookie is partitioned (CHIPS) |
| `maxAge` | `number \| undefined` | Max age in seconds |
| `httpOnly` | `boolean` | Whether accessible only via HTTP (not JavaScript) |

### Methods

#### `isExpired(): boolean`

Checks expiration status. A cookie with a past `expires` Date returns `true`. One using `maxAge` (e.g., 3600 seconds) returns `false`. A session cookie with no expiration also returns `false`.

#### `serialize(): string` / `toString(): string`

Both return a string suitable for a `Set-Cookie` header, including all attributes (Domain, Path, Expires, Secure, HttpOnly, SameSite, etc.).

#### `toJSON(): CookieInit`

Converts the cookie to a plain object for JSON serialization. Also works directly with `JSON.stringify(cookie)`.

### Static Methods

#### `Cookie.parse(cookieString: string): Cookie`

Parses a Set-Cookie-style string into a `Cookie` instance. Extracts name, value, and all attributes (Path, Secure, SameSite, etc.).

#### `Cookie.from(name: string, value: string, options?: CookieInit): Cookie`

Factory method for creating a cookie with the given name, value, and optional attributes.

## Types

### `CookieInit`

```ts
interface CookieInit {
  name?: string;
  value?: string;
  domain?: string;
  path?: string;       // Defaults to '/'. Use empty string to let browser set path.
  expires?: number | Date | string;
  secure?: boolean;
  sameSite?: CookieSameSite;  // Defaults to `lax`.
  httpOnly?: boolean;
  partitioned?: boolean;
  maxAge?: number;
}
```

### `CookieStoreDeleteOptions`

```ts
interface CookieStoreDeleteOptions {
  name: string;
  domain?: string | null;
  path?: string;
}
```

### `CookieStoreGetOptions`

```ts
interface CookieStoreGetOptions {
  name?: string;
  url?: string;
}
```

### `CookieSameSite`

```ts
type CookieSameSite = "strict" | "lax" | "none";
```

### Full Class Signatures

**Cookie class:**
- Constructors accept `(name, value, options?)`, `(cookieString)`, or `(cookieObject)`
- Readonly `name`; mutable `value`, `domain`, `path`, `expires`, `secure`, `sameSite`, `partitioned`, `maxAge`, `httpOnly`
- Instance methods: `isExpired()`, `serialize()`, `toString()`, `toJSON()`
- Static methods: `parse()`, `from()`

**CookieMap class:**
- Implements `Iterable<[string, string]>`
- Constructor accepts `string[][]`, `Record<string, string>`, or `string`
- Methods: `get()`, `has()`, `set()` (3 overloads), `delete()` (2 overloads), `toJSON()`, `toSetCookieHeaders()`
- Iteration: `entries()`, `keys()`, `values()`, `forEach()`, `[Symbol.iterator]()`
- Readonly property: `size`
