# Bun Transpiler

## Overview

Bun exposes its internal transpiler through the `Bun.Transpiler` class. Creating an instance requires specifying options, at minimum a loader:

```ts
const transpiler = new Bun.Transpiler({
  loader: "tsx", // "js" | "jsx" | "ts" | "tsx"
});
```

## `.transformSync()`

This method transpiles code synchronously. It does not resolve modules or execute code — the output is a string of vanilla JavaScript.

```ts
const transpiler = new Bun.Transpiler({
  loader: 'tsx',
});

const code = `
import * as whatever from "./whatever.ts"
export function Home(props: {title: string}){
  return <p>{props.title}</p>;
}`;

const result = transpiler.transformSync(code);
```

A second argument can override the default loader:

```ts
transpiler.transformSync("<div>hi!</div>", "tsx");
```

### Technical Details

The transpiler runs in the same thread as the calling code. If macros are used, they execute in the same thread but a separate event loop. Globals are shared between macros and regular code. Using AST nodes outside a macro context is undefined behavior.

## `.transform()`

An async counterpart to `.transformSync()` that returns a `Promise<string>`.

```js
const transpiler = new Bun.Transpiler({ loader: "jsx" });
const result = await transpiler.transform("<div>hi!</div>");
console.log(result);
```

> Unless transpiling many large files, `transformSync` is preferable since the cost of the threadpool will often take longer than actually transpiling code.

Override the loader with a second argument:

```ts
await transpiler.transform("<div>hi!</div>", "tsx");
```

### Technical Details

The `.transform()` method runs in Bun's worker threadpool. Calling it 100 times distributes work across `Math.floor($cpu_count * 0.8)` threads without blocking the main JavaScript thread. If a macro is used, a new copy of Bun's JavaScript runtime environment may spawn in that thread.

## `.scan()`

Scans source code and returns imports and exports along with metadata. Type-only imports/exports (using TypeScript's `import type` / `export type` syntax) are ignored.

```ts
const transpiler = new Bun.Transpiler({ loader: "tsx" });

const code = `
import React from 'react';
import type {ReactNode} from 'react';
const val = require('./cjs.js')
import('./loader');

export const name = "hello";
`;

const result = transpiler.scan(code);
```

**Output:**

```json
{
  "exports": ["name"],
  "imports": [
    { "kind": "import-statement", "path": "react" },
    { "kind": "require-call", "path": "./cjs.js" },
    { "kind": "dynamic-import", "path": "./loader" }
  ]
}
```

Each import object contains a `path` and `kind`. The recognized import kinds are:

| Kind | Description |
|------|-------------|
| `import-statement` | Standard ES module imports (`import foo from 'bar'`) |
| `require-call` | CommonJS `require()` calls |
| `require-resolve` | `require.resolve()` calls |
| `dynamic-import` | Dynamic `import()` expressions |
| `import-rule` | CSS `@import` rules |
| `url-token` | CSS `url()` tokens |

## `.scanImports()`

A faster alternative to `.scan()` optimized for performance-sensitive code. It returns only imports (not exports) and is marginally less accurate due to some performance optimizations.

```ts
const transpiler = new Bun.Transpiler({ loader: "tsx" });

const code = `
import React from 'react';
import type {ReactNode} from 'react';
const val = require('./cjs.js')
import('./loader');

export const name = "hello";
`;

const result = transpiler.scanImports(code);
```

**Output:**

```json
[
  { "kind": "import-statement", "path": "react" },
  { "kind": "require-call", "path": "./cjs.js" },
  { "kind": "dynamic-import", "path": "./loader" }
]
```

## API Reference

### `Loader` Type

```ts
type Loader = "jsx" | "js" | "ts" | "tsx";
```

### `TranspilerOptions` Interface

| Option | Type | Description |
|--------|------|-------------|
| `define` | `Record<string, string>` | Replace keys with values. Values must be JSON strings |
| `loader` | `Loader` | Default loader for this transpiler |
| `target` | `"browser" \| "bun" \| "node"` | Target platform |
| `tsconfig` | `string \| TSConfig` | A tsconfig.json as stringified JSON or object |
| `macro` | `MacroMap` | Replace imports with macros |
| `exports` | `{ eliminate?: string[]; replace?: Record<string, string> }` | Specify exports to eliminate or rename |
| `trimUnusedImports` | `boolean` | Remove unused imports from transpiled output (default: `false`) |
| `minifyWhitespace` | `boolean` | Experimental whitespace minification |
| `inline` | `boolean` | Inline constant values (default: `true`) |

### `MacroMap` Interface

```ts
interface MacroMap {
  [packagePath: string]: {
    [importItemName: string]: string,
  },
}
```

Example:
```json
{
  "react-relay": {
    "graphql": "bun-macro-relay/bun-macro-relay.tsx"
  }
}
```

### `Bun.Transpiler` Class

```ts
class Bun.Transpiler {
  constructor(options: TranspilerOptions)

  transform(code: string, loader?: Loader): Promise<string>
  transformSync(code: string, loader?: Loader): string

  scan(code: string): {exports: string[], imports: Import}
  scanImports(code: string): Import[]
}
```

### `Import` Type

```ts
type Import = {
  path: string,
  kind:
    | "import-statement"
    | "require-call"
    | "require-resolve"
    | "dynamic-import"
    | "import-rule"
    | "url-token"
    | "internal"              // The import was injected by Bun
    | "entry-point-build"     // Entry point (not common)
    | "entry-point-run"       // Entry point (not common)
}
```
