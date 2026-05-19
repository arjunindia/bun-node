# Module Resolution in Bun

## Syntax and File Resolution

When importing from a relative path without an extension, Bun searches for matching files in a specific order. Given `import { hello } from "./hello"`, Bun checks:

1. `./hello.tsx`
2. `./hello.jsx`
3. `./hello.ts`
4. `./hello.mjs`
5. `./hello.js`
6. `./hello.cjs`
7. `./hello.json`
8. `./hello/index.tsx`
9. `./hello/index.jsx`
10. `./hello/index.ts`
11. `./hello/index.mjs`
12. `./hello/index.js`
13. `./hello/index.cjs`
14. `./hello/index.json`

Extensioned imports are optional but supported. When an extension is present, Bun only checks for a file matching that exact extension.

When importing with `.js` or `.jsx` extensions, Bun additionally checks for corresponding `.ts`/`.tsx` files for TypeScript ESM compatibility.

**Example (index.ts):**
```ts
import { hello } from "./hello";
import { hello } from "./hello.ts"; // this works
import { hello } from "./hello.js"; // this also works
```

**Example (hello.ts):**
```ts
export function hello() {
  console.log("Hello world!");
}
```

Running `bun index.ts` prints "Hello world!".

Bun supports both ES modules (`import`/`export`) and CommonJS (`require()`/`module.exports`). CommonJS is discouraged for new projects.

## Module Systems

Bun natively supports CommonJS and ES Modules. In Bun's runtime, `require` works with both module types. When the target is an ES Module, `require` returns the module namespace object. For CommonJS targets, it returns `module.exports`.

| Module Type | `require()`      | `import * as`                                                        |
|-------------|------------------|----------------------------------------------------------------------|
| ES Module   | Module Namespace | Module Namespace                                                     |
| CommonJS    | module.exports   | `default` is `module.exports`, keys of module.exports are named exports |

### Using `require()`

You can `require()` any file or package, including `.ts` or `.mjs` files. Extensions remain optional.

```ts
const { foo } = require("./foo"); // extensions are optional
const { bar } = require("./bar.mjs");
const { baz } = require("./baz.tsx");
```

### What is a CommonJS Module?

CommonJS modules use `module.exports` to export values and `require` to import them. Key differences from ES Modules:

- CommonJS modules are synchronous; ES Modules are asynchronous (though static imports are also synchronous)
- ES Modules support top-level `await`; CommonJS does not
- ES Modules are always in strict mode; CommonJS modules are not
- Browsers lack native CommonJS support but support ES Modules via `<script type="module">`
- CommonJS modules are not statically analyzable; ES Modules only allow static imports/exports

Dynamic imports via `import()` in ES Modules are asynchronous and don't block execution.

### Using `import`

You can `import` any file or package, including `.cjs` files.

```ts
import { foo } from "./foo"; // extensions are optional
import bar from "./bar.ts";
import { stuff } from "./my-commonjs.cjs";
```

### Using `import` and `require()` Together

Bun allows both `import` and `require` in the same file at all times.

```ts
import { stuff } from "./my-commonjs.cjs";
import Stuff from "./my-commonjs.cjs";
const myStuff = require("./my-commonjs.cjs");
```

### Top Level Await

The one exception: you cannot `require()` a file using top-level await, since `require()` is synchronous. Very few libraries use top-level await. If your application code uses it, ensure that file isn't `require()`'d from elsewhere. Use `import` or dynamic `import()` instead.

## Importing Packages

Bun implements the Node.js module resolution algorithm, allowing imports from `node_modules` using bare specifiers.

```ts
import { stuff } from "foo";
```

When you import `from "foo"`, Bun scans up the file system for a `node_modules` directory containing that package.

### NODE_PATH

Bun supports `NODE_PATH` for additional module resolution directories:

```bash
NODE_PATH=./packages bun run src/index.js
```

Multiple paths use the platform delimiter (`:` on Unix, `;` on Windows):

```bash
NODE_PATH=./packages:./lib bun run src/index.js  # Unix/macOS
NODE_PATH=./packages;./lib bun run src/index.js  # Windows
```

### Package Entrypoint Resolution

After finding a package, Bun reads `package.json` to determine entrypoint. It checks the `exports` field for conditions in this order:

1. `"bun"`
2. `"node"`
3. `"require"` (if importer is CommonJS)
4. `"import"` (if importer is ES module)
5. `"default"`

The first matching condition is used.

```json
{
  "name": "foo",
  "exports": {
    "bun": "./index.js",
    "node": "./index.js",
    "require": "./index.js",
    "import": "./index.mjs",
    "default": "./index.js"
  }
}
```

Bun respects subpath `"exports"` and `"imports"`.

Subpath and conditional imports work together:

```json
{
  "name": "foo",
  "exports": {
    ".": {
      "import": "./index.mjs",
      "require": "./index.js"
    }
  }
}
```

When any subpath is specified in the `"exports"` map, only explicitly exported subpaths are importable:

```ts
import stuff from "foo"; // this works
import stuff from "foo/index.mjs"; // this doesn't
```

**Shipping TypeScript:** Bun supports the special `"bun"` export condition. Libraries written in TypeScript can publish un-transpiled TypeScript files to npm. Specifying the `.ts` entrypoint in the `"bun"` condition lets Bun directly import and execute TypeScript source files.

If `exports` is not defined, Bun falls back to `"module"` (ESM imports only), then `"main"`.

```json
{
  "name": "foo",
  "module": "./index.js",
  "main": "./index.js"
}
```

### Custom Conditions

The `--conditions` flag specifies conditions for resolving packages from `package.json` `"exports"`. Works with both `bun build` and Bun's runtime.

```sh
# With bun build:
bun build --conditions="react-server" --target=bun ./app/foo/route.js

# With bun's runtime:
bun --conditions="react-server" ./app/foo/route.js
```

Programmatic usage with `Bun.build`:

```ts
await Bun.build({
  conditions: ["react-server"],
  target: "bun",
  entryPoints: ["./app/foo/route.js"],
});
```

## Path Re-mapping

Bun supports import path re-mapping through TypeScript's `compilerOptions.paths` in `tsconfig.json`. Non-TypeScript users can use `jsconfig.json` for the same behavior.

```json
{
  "compilerOptions": {
    "paths": {
      "config": ["./config.ts"],
      "components/*": ["components/*"]
    }
  }
}
```

Bun also supports Node.js-style subpath imports in `package.json` where mapped paths must start with `#`:

```json
{
  "imports": {
    "#config": "./config.ts",
    "#components/*": "./components/*"
  }
}
```

Both approaches can be used together.

### Low-level CommonJS Interop Details

When Bun's transpiler detects `module.exports` usage, it treats the file as CommonJS. The module loader wraps the transpiled module in a function:

```js
(function (module, exports, require) {
  // transpiled module
})(module, exports, require);
```

These are assigned via a `with scope` in C++. An internal `Map` stores the `exports` object to handle cyclical `require` calls before the module is fully loaded.

After evaluation, a Synthetic Module Record is created with `default` set to `module.exports`, and keys of `module.exports` are re-exported as named exports (if it's an object).

When using Bun's bundler, CommonJS modules are wrapped in a `require_${moduleName}` function returning the `module.exports` object.

## `import.meta`

The `import.meta` object provides self-referential module information. Bun implements these properties:

| Property | Description |
|----------|-------------|
| `import.meta.dir` | Absolute path to the directory containing the current file. Equivalent to `__dirname` in CommonJS |
| `import.meta.dirname` | Alias to `import.meta.dir` for Node.js compatibility |
| `import.meta.env` | Alias to `process.env` |
| `import.meta.file` | Name of the current file, e.g. `index.tsx` |
| `import.meta.path` | Absolute path to the current file. Equivalent to `__filename` in CommonJS |
| `import.meta.filename` | Alias to `import.meta.path` for Node.js compatibility |
| `import.meta.main` | `true` if the file is the entrypoint directly executed by `bun run`, `false` otherwise |
| `import.meta.resolve` | Resolves a module specifier to a URL. Equivalent to browser `import.meta.resolve` |
| `import.meta.url` | String URL to the current file, e.g. `file:///path/to/project/index.ts` |

**Example:**
```ts
import.meta.dir; // => "/path/to/project"
import.meta.file; // => "file.ts"
import.meta.path; // => "/path/to/project/file.ts"
import.meta.url; // => "file:///path/to/project/file.ts"
import.meta.main; // `true` if directly executed by `bun run`
import.meta.resolve("zod"); // => "file:///path/to/project/node_modules/zod/index.js"
```
