# Bun File System Router

## Overview

Bun offers a high-performance API for matching routes against file-system paths. This is primarily intended for library authors. Currently, only Next.js-style file-system routing is supported, though additional styles may be introduced later.

## Next.js-style Routing

The `FileSystemRouter` class resolves routes against a `pages` directory. Note that the Next.js 13 `app` directory is not yet supported.

### Example Directory Structure

```
pages
├── index.tsx
├── settings.tsx
├── blog
│   ├── [slug].tsx
│   └── index.tsx
└── [[...catchall]].tsx
```

### Basic Usage

```ts
const router = new Bun.FileSystemRouter({
  style: "nextjs",
  dir: "./pages",
  origin: "https://mydomain.com",
  assetPrefix: "_next/static/"
});

router.match("/");
// {
//   filePath: "/path/to/pages/index.tsx",
//   kind: "exact",
//   name: "/",
//   pathname: "/",
//   src: "https://mydomain.com/_next/static/pages/index.tsx"
// }
```

### Query Parameters

Query parameters are automatically parsed and returned via the `query` property:

```ts
router.match("/settings?foo=bar");
// {
//   filePath: "/path/to/pages/settings.tsx",
//   kind: "dynamic",
//   name: "/settings",
//   pathname: "/settings?foo=bar",
//   src: "https://mydomain.com/_next/static/pages/settings.tsx",
//   query: { foo: "bar" }
// }
```

### Dynamic Route Parameters

URL parameters are parsed automatically and returned in the `params` property:

```ts
router.match("/blog/my-cool-post");
// {
//   filePath: "/path/to/pages/blog/[slug].tsx",
//   kind: "dynamic",
//   name: "/blog/[slug]",
//   pathname: "/blog/my-cool-post",
//   src: "https://mydomain.com/_next/static/pages/blog/[slug].tsx",
//   params: { slug: "my-cool-post" }
// }
```

### Accepting Request/Response Objects

The `.match()` method also accepts `Request` and `Response` objects:

```ts
router.match(new Request("https://example.com/blog/my-cool-post"));
```

### Reloading

The router reads directory contents at initialization. To re-scan the file system:

```ts
router.reload();
```

## API Reference

### Constructor Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `dir` | `string` | Yes | Path to the pages directory |
| `style` | `"nextjs"` | Yes | Routing style (only `"nextjs"` supported currently) |
| `origin` | `string` | No | Base origin used when constructing `src` URLs |
| `assetPrefix` | `string` | No | Prefix prepended to asset paths in the `src` field |
| `fileExtensions` | `string[]` | No | File extensions to consider when scanning the directory |

### Methods

**`reload(): void`** — Re-scans the directory to pick up file changes.

**`match(path: string | Request | Response)`** — Resolves a route. Returns an object or `null`.

### Match Result Properties

| Property | Type | Description |
|---|---|---|
| `filePath` | `string` | Absolute path to the matched file |
| `kind` | `"exact" \| "catch-all" \| "optional-catch-all" \| "dynamic"` | Type of route match |
| `name` | `string` | Route name derived from the file path |
| `pathname` | `string` | The URL pathname that was matched |
| `src` | `string` | Full source URL combining origin, asset prefix, and file path |
| `params` | `Record<string, string>` (optional) | Parsed dynamic route parameters |
| `query` | `Record<string, string>` (optional) | Parsed query string parameters |

### Full Type Signature

```ts
interface Bun {
  class FileSystemRouter {
    constructor(params: {
      dir: string;
      style: "nextjs";
      origin?: string;
      assetPrefix?: string;
      fileExtensions?: string[];
    });

    reload(): void;

    match(path: string | Request | Response): {
      filePath: string;
      kind: "exact" | "catch-all" | "optional-catch-all" | "dynamic";
      name: string;
      pathname: string;
      src: string;
      params?: Record<string, string>;
      query?: Record<string, string>;
    } | null;
  }
}
```
