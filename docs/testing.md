# Test runner

> Bun's fast, built-in, Jest-compatible test runner with TypeScript support, lifecycle hooks, mocking, and watch mode

Bun ships with a fast, built-in, Jest-compatible test runner. Tests are executed with the Bun runtime, and support the following features.

* TypeScript and JSX
* Lifecycle hooks
* Snapshot testing
* UI & DOM testing
* Watch mode with `--watch`
* Script pre-loading with `--preload`

## Run tests

```bash
bun test
```

Tests are written in JavaScript or TypeScript with a Jest-like API.

```ts
import { expect, test } from "bun:test";

test("2 + 2", () => {
  expect(2 + 2).toBe(4);
});
```

The runner recursively searches the working directory for files that match the following patterns:

* `*.test.{js|jsx|ts|tsx}`
* `*_test.{js|jsx|ts|tsx}`
* `*.spec.{js|jsx|ts|tsx}`
* `*_spec.{js|jsx|ts|tsx}`

You can filter the set of *test files* to run by passing additional positional arguments:

```bash
bun test <filter> <filter> ...
```

To filter by *test name*, use the `-t`/`--test-name-pattern` flag:

```sh
bun test --test-name-pattern addition
```

To run a specific file:

```bash
bun test ./test/specific-file.test.ts
```

## CI/CD integration

### GitHub Actions

`bun test` automatically detects if it's running inside GitHub Actions and will emit GitHub Actions annotations.

```yaml
jobs:
  build:
    name: build-app
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Install bun
        uses: oven-sh/setup-bun@v2
      - name: Install dependencies
        run: bun install
      - name: Run tests
        run: bun test
```

### JUnit XML reports (GitLab, etc.)

```sh
bun test --reporter=junit --reporter-outfile=./bun.xml
```

## Timeouts

Use the `--timeout` flag to specify a *per-test* timeout in milliseconds. Default: `5000`.

```bash
bun test --timeout 20
```

## Concurrent test execution

### `--concurrent` flag

```sh
bun test --concurrent
```

### `--max-concurrency` flag

```sh
bun test --concurrent --max-concurrency 4
```

Default: 20.

### `test.concurrent`

```ts
import { test, expect } from "bun:test";

test.concurrent("concurrent test 1", async () => {
  await fetch("/api/endpoint1");
  expect(true).toBe(true);
});

test.concurrent("concurrent test 2", async () => {
  await fetch("/api/endpoint2");
  expect(true).toBe(true);
});

test("sequential test", () => {
  expect(1 + 1).toBe(2);
});
```

### `test.serial`

```ts
import { test, expect } from "bun:test";

let sharedState = 0;

test.serial("first serial test", () => {
  sharedState = 1;
  expect(sharedState).toBe(1);
});

test.serial("second serial test", () => {
  expect(sharedState).toBe(1);
  sharedState = 2;
});

test("independent test", () => {
  expect(true).toBe(true);
});

test.failing.each([1, 2, 3])("chained qualifiers %d", input => {
  expect(input).toBe(0);
});
```

## Retry failed tests

```sh
bun test --retry 3
```

Per-test overrides:

```ts
test("uses global retry", () => { /* ... */ });

test("custom retry", { retry: 1 }, () => { /* ... */ });
```

In `bunfig.toml`:

```toml
[test]
retry = 3
```

## Rerun tests

```sh
bun test --rerun-each 100
```

## Randomize test execution order

```sh
bun test --randomize
```

### Reproducible random order with `--seed`

```sh
bun test --seed 123456
```

## Bail out with `--bail`

```sh
bun test --bail
bun test --bail=10
```

## Watch mode

```bash
bun test --watch
```

## Lifecycle hooks

| Hook         | Description                 |
| ------------ | --------------------------- |
| `beforeAll`  | Runs once before all tests. |
| `beforeEach` | Runs before each test.      |
| `afterEach`  | Runs after each test.       |
| `afterAll`   | Runs once after all tests.  |

```sh
bun test --preload ./setup.ts
```

## Mocks

```ts
import { test, expect, mock } from "bun:test";
const random = mock(() => Math.random());

test("random", () => {
  const val = random();
  expect(val).toBeGreaterThan(0);
  expect(random).toHaveBeenCalled();
  expect(random).toHaveBeenCalledTimes(1);
});
```

Or using `jest.fn()`:

```ts
import { test, expect, jest } from "bun:test";
const random = jest.fn(() => Math.random());
```

## Snapshot testing

```ts
import { test, expect } from "bun:test";

test("snapshot", () => {
  expect({ a: 1 }).toMatchSnapshot();
});
```

To update snapshots:

```sh
bun test --update-snapshots
```

## UI & DOM testing

Bun is compatible with:

* HappyDOM
* DOM Testing Library
* React Testing Library

## AI Agent Integration

Set environment variables for quieter output:

* `CLAUDECODE=1` - For Claude Code
* `REPL_ID=1` - For Replit
* `AGENT=1` - Generic AI agent flag

```bash
CLAUDECODE=1 bun test
```

---

# CLI Usage

```bash
bun test <patterns>
```

### Execution Control

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--timeout` | number | 5000 | Per-test timeout in milliseconds |
| `--rerun-each` | number | - | Re-run each test file N times |
| `--retry` | number | - | Default retry count for all tests |
| `--concurrent` | boolean | - | Treat all tests as `test.concurrent()` |
| `--randomize` | boolean | - | Run tests in random order |
| `--seed` | number | - | Set the random seed for test randomization |
| `--bail` | number | 1 | Exit after N failures |
| `--max-concurrency` | number | 20 | Maximum concurrent tests |

### Test Filtering

| Flag | Type | Description |
|------|------|-------------|
| `--todo` | boolean | Include `test.todo()` tests |
| `--test-name-pattern` | string | Run only tests matching the regex. Alias: `-t` |

### Reporting

| Flag | Type | Description |
|------|------|-------------|
| `--reporter` | string | Reporter format: `junit`, `dots` |
| `--reporter-outfile` | string | Output file path for the reporter |
| `--dots` | boolean | Enable dots reporter |

### Coverage

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--coverage` | boolean | - | Generate a coverage profile |
| `--coverage-reporter` | string | `text` | Report format: `text`, `lcov` |
| `--coverage-dir` | string | `coverage` | Directory for coverage files |

### Snapshots

| Flag | Type | Description |
|------|------|-------------|
| `--update-snapshots` | boolean | Update snapshot files. Alias: `-u` |

## Examples

```bash
bun test                           # Run all test files
bun test foo bar                   # Run files with "foo" or "bar" in name
bun test --test-name-pattern baz   # Run tests whose names include "baz"
```
