# Bun Glob

Bun provides a fast native implementation of file globbing through its `Glob` class.

## Quickstart

### Scanning for Files

The `Glob` class can recursively scan directories. A basic example creates a glob pattern for TypeScript files:

```ts
import { Glob } from "bun";
const glob = new Glob("**/*.ts");
for await (const file of glob.scan(".")) {
  console.log(file);
}
```

The `scan()` method on the current working directory traverses each sub-directory recursively.

### Matching Strings

You can also test individual paths against a pattern:

```ts
import { Glob } from "bun";
const glob = new Glob("*.ts");
glob.match("index.ts");  // => true
glob.match("index.js");  // => false
```

## Full API Interface

The `Glob` class exposes these methods:

- **`scan(root: string | ScanOptions): AsyncIterable<string>`** — asynchronous directory scanning
- **`scanSync(root: string | ScanOptions): Iterable<string>`** — synchronous directory scanning
- **`match(path: string): boolean`** — tests a path against the pattern

### ScanOptions

The `scan` and `scanSync` methods accept either a string (root directory path) or an options object with the following properties:

| Option | Type | Default | Description |
|---|---|---|---|
| `cwd` | `string` | `process.cwd()` | The root directory to start matching from |
| `dot` | `boolean` | `false` | Allow patterns to match entries that begin with a period (`.`) |
| `absolute` | `boolean` | `false` | Return the absolute path for entries |
| `followSymlinks` | `boolean` | `false` | Indicates whether to traverse descendants of symbolic link directories |
| `throwErrorOnBrokenSymlink` | `boolean` | `false` | Throw an error when symbolic link is broken |
| `onlyFiles` | `boolean` | `true` | Return only files |

## Supported Glob Patterns

### `?` — Match any single character

Matches exactly one character. Example: `"???.ts"` matches `"foo.ts"` but not `"foobar.ts"`.

### `*` — Matches zero or more characters, except path separators

Matches any number of characters *except* `/` or `\`. Example: `"*.ts"` matches `"index.ts"` but not `"src/index.ts"`.

### `**` — Match any number of characters including `/`

Recursively matches across directory boundaries. Example: `"**/*.ts"` matches both `"index.ts"` and `"src/index.ts"`, but not `"src/index.js"`.

### `[ab]` — Character classes and ranges

Matches one of the characters in brackets, plus supports ranges and negation. Example: `"ba[rz].ts"` matches `"bar.ts"` and `"baz.ts"` but not `"bat.ts"`.

Supported features:
- **Character ranges**: e.g., `[0-9]`, `[a-z]`
- **Negation operators**: `^` or `!` match anything *except* the specified characters (e.g., `[^ab]`, `[!a-z]`)

Complex example: `"ba[a-z][0-9][^4-9].ts"` matches `"bar01.ts"` and `"baz83.ts"`, but not `"bat24.ts"` (because `4` is in the negated range `4-9`).

### `{a,b,c}` — Alternation (match any of the given patterns)

Matches any of the comma-separated sub-patterns. Example: `"{a,b,c}.ts"` matches `"a.ts"`, `"b.ts"`, and `"c.ts"`, but not `"d.ts"`.

These can be deeply nested (up to 10 levels) and may contain any of the other wildcard types.

### `!` — Negation at the start of a pattern

Negates the entire result. Example: `"!index.ts"` does *not* match `"index.ts"` but matches `"foo.ts"`.

### `\` — Escape character

Escapes any special glob character. Example: `"\\!index.ts"` matches the literal filename `"!index.ts"` but not `"index.ts"`.

## Node.js `fs.glob()` Compatibility

Bun implements Node.js's `fs.glob()` functions with additional features:

```ts
import { glob, globSync, promises } from "node:fs";
const files = await promises.glob(["**/*.ts", "**/*.js"]);
const filtered = await promises.glob("**/*", {
  exclude: ["node_modules/**", "*.test.*"],
});
```

All three functions are supported:
- `fs.glob()`
- `fs.globSync()`
- `fs.promises.glob()`

Enhancements beyond standard Node.js include:
- **Array of patterns** as the first argument
- **`exclude` option** to filter out unwanted results
