# Bun Semver API

Bun provides a built-in semantic versioning API for comparing versions and checking compatibility with version ranges. The implementation is designed to be compatible with `node-semver` (used by npm clients) and delivers approximately 20x faster performance than `node-semver`.

The API currently exposes two functions via the `Bun.semver` namespace (importable from `"bun"`).

## `Bun.semver.satisfies(version: string, range: string): boolean`

**Purpose:** Determines whether a given version string falls within a specified semver range.

**Returns:** `true` if the version satisfies the range; `false` otherwise.

**Error handling:** Both an invalid `range` and an invalid `version` will cause the function to return `false`.

### Supported Range Syntax

The examples below demonstrate the range formats supported:

- **Caret ranges** (`^`): `^1.0.0` matches `1.0.0` but not `1.0.0` against `^1.0.1`
- **Tilde ranges** (`~`): `~1.0.0` matches `1.0.0` but not against `~1.0.1`
- **Exact versions**: `1.0.0` matches itself; `1.0.1` does not match `1.0.0`
- **Wildcard patch/minor/major**: `1.0.x`, `1.x.x`, and `x.x.x` all match `1.0.0`
- **Hyphen ranges**: `1.0.0 - 2.0.0` and `1.0.0 - 1.0.1` both match `1.0.0`

### Code Example

```typescript
import { semver } from "bun";

semver.satisfies("1.0.0", "^1.0.0"); // true
semver.satisfies("1.0.0", "^1.0.1"); // false
semver.satisfies("1.0.0", "~1.0.0"); // true
semver.satisfies("1.0.0", "~1.0.1"); // false
semver.satisfies("1.0.0", "1.0.0");  // true
semver.satisfies("1.0.0", "1.0.1");  // false
semver.satisfies("1.0.1", "1.0.0");  // false
semver.satisfies("1.0.0", "1.0.x");  // true
semver.satisfies("1.0.0", "1.x.x");  // true
semver.satisfies("1.0.0", "x.x.x");  // true
semver.satisfies("1.0.0", "1.0.0 - 2.0.0"); // true
semver.satisfies("1.0.0", "1.0.0 - 1.0.1"); // true
```

## `Bun.semver.order(versionA: string, versionB: string): 0 | 1 | -1`

**Purpose:** Compares two version strings and returns a sort-friendly numeric result.

**Returns:**
- `0` when both versions are equal
- `1` when `versionA` is greater than `versionB`
- `-1` when `versionA` is less than `versionB`

### Code Example

```typescript
import { semver } from "bun";

semver.order("1.0.0", "1.0.0"); // 0
semver.order("1.0.0", "1.0.1"); // -1
semver.order("1.0.1", "1.0.0"); // 1

const unsorted = ["1.0.0", "1.0.1", "1.0.0-alpha", "1.0.0-beta", "1.0.0-rc"];
unsorted.sort(semver.order);
// Result: ["1.0.0-alpha", "1.0.0-beta", "1.0.0-rc", "1.0.0", "1.0.1"]
```

The example above shows that pre-release tags (alpha, beta, rc) are correctly ordered before their corresponding release versions when using `semver.order` as a comparator for `Array.sort()`.

## Extensibility Note

The documentation encourages users to open an issue or pull request if additional semver functions beyond `satisfies` and `order` are needed.
