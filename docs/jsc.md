# bun:jsc Module

The `bun:jsc` module provides direct access to Bun's underlying JavaScriptCore (JSC) engine internals for garbage collection control, profiling, serialization, and JIT debugging.

> **Note:** This module is Bun-specific and not available in Node.js or other runtimes. APIs may change between Bun versions without notice.

## Usage

```js
import { serialize, deserialize } from "bun:jsc";
// or
import { jsc } from "bun:jsc";
```

---

## Interfaces

### `HeapStats`
Interface for heap statistics data returned by `heapStats()`.

### `MemoryUsage`
Interface for memory usage data returned by `memoryUsage()`.

### `SamplingProfile`
Interface for sampling profiler data returned by `startSamplingProfiler()` / `profile()`.

---

## Garbage Collection

### `fullGC()`
Triggers a full garbage collection cycle.

```js
import { fullGC } from "bun:jsc";
fullGC();
```

### `edenGC()`
Triggers an Eden (young generation/incremental) garbage collection cycle. Targets only newly-allocated objects rather than performing a full heap collection.

```js
import { edenGC } from "bun:jsc";
edenGC();
```

### `gcAndSweep()`
Triggers garbage collection followed by a sweep of unreachable objects.

```js
import { gcAndSweep } from "bun:jsc";
gcAndSweep();
```

### `releaseWeakRefs()`
Manually releases processed `WeakRef` targets and runs `FinalizationRegistry` callbacks.

```js
import { releaseWeakRefs } from "bun:jsc";
releaseWeakRefs();
```

### `getProtectedObjects()`
Returns objects currently protected from garbage collection.

```js
import { getProtectedObjects } from "bun:jsc";
const protected = getProtectedObjects();
```

---

## Heap & Memory

### `heapSize()`
Returns the current heap size in bytes.

```js
import { heapSize } from "bun:jsc";
const size = heapSize();
console.log(size); // => 1234567
```

### `heapStats()`
Returns detailed heap statistics, conforming to the `HeapStats` interface.

```js
import { heapStats } from "bun:jsc";
const stats = heapStats();
```

### `memoryUsage()`
Returns detailed memory usage information conforming to the `MemoryUsage` interface.

```js
import { memoryUsage } from "bun:jsc";
const usage = memoryUsage();
```

### `estimateShallowMemoryUsageOf()`
Estimates the shallow memory usage of a given JavaScript object in bytes, excluding the memory usage of properties or other objects it references. For accurate per-object memory usage, use `Bun.generateHeapSnapshot`.

```js
import { estimateShallowMemoryUsageOf } from "bun:jsc";

const obj = { foo: "bar" };
const usage = estimateShallowMemoryUsageOf(obj);
console.log(usage); // => 16

const buffer = Buffer.alloc(1024 * 1024);
estimateShallowMemoryUsageOf(buffer);
// => 1048624

const req = new Request("https://bun.com");
estimateShallowMemoryUsageOf(req);
// => 167

const array = Array(1024).fill({ a: 1 });
// Arrays are usually not stored contiguously in memory, so this will not return a useful value (which isn't a bug).
estimateShallowMemoryUsageOf(array);
// => 16
```

---

## Serialization

### `serialize()`
Serializes a JavaScript value into a binary `ArrayBuffer` format using the HTML Structured Clone Algorithm (same as `structuredClone` and `postMessage`).

```js
import { serialize, deserialize } from "bun:jsc";

const buf = serialize({ foo: "bar" });
const obj = deserialize(buf);
console.log(obj); // => { foo: "bar" }
```

### `deserialize()`
Deserializes a previously serialized JavaScript value from an ArrayBuffer.

```js
import { serialize, deserialize } from "bun:jsc";

const buf = serialize({ foo: "bar" });
const obj = deserialize(buf);
console.log(obj); // => { foo: "bar" }
```

---

## Profiling

### `startSamplingProfiler()`
Starts a sampling profiler to collect CPU profile data.

```js
import { startSamplingProfiler } from "bun:jsc";
startSamplingProfiler();
```

### `profile()`
Returns a sampling profile result conforming to the `SamplingProfile` interface.

```js
import { profile } from "bun:jsc";
const result = profile();
```

### `totalCompileTime()`
Returns the total time spent in JIT compilation.

```js
import { totalCompileTime } from "bun:jsc";
const time = totalCompileTime();
```

### `numberOfDFGCompiles()`
Returns the number of DFG (Data Flow Graph) JIT compilations that have occurred.

```js
import { numberOfDFGCompiles } from "bun:jsc";
const count = numberOfDFGCompiles();
```

### `reoptimizationRetryCount()`
Returns the number of JIT reoptimization retry attempts.

```js
import { reoptimizationRetryCount } from "bun:jsc";
const count = reoptimizationRetryCount();
```

---

## JIT Control

### `optimizeNextInvocation()`
Triggers JIT optimization for the next invocation of a function.

```js
import { optimizeNextInvocation } from "bun:jsc";
optimizeNextInvocation();
```

### `noFTL()`
Disables FTL (Faster Than Light) JIT compilation for the current runtime.

```js
import { noFTL } from "bun:jsc";
noFTL();
```

### `noOSRExitFuzzing()`
Disables OSR (On-Stack Replacement) exit fuzzing.

```js
import { noOSRExitFuzzing } from "bun:jsc";
noOSRExitFuzzing();
```

---

## Debugging & Inspection

### `jscDescribe()`
Returns a string description of a JavaScript value's internal JSC representation.

```js
import { jscDescribe } from "bun:jsc";
const desc = jscDescribe({ foo: "bar" });
```

### `jscDescribeArray()`
Returns a string description of an array's internal JSC representation.

```js
import { jscDescribeArray } from "bun:jsc";
const desc = jscDescribeArray([1, 2, 3]);
```

### `isRope()`
Checks whether a string is internally represented as a "rope" (a lazy concatenated string in JSC).

```js
import { isRope } from "bun:jsc";
const str = "hello" + "world";
console.log(isRope(str)); // => true or false
```

### `callerSourceOrigin()`
Returns the source origin of the calling code.

```js
import { callerSourceOrigin } from "bun:jsc";
const origin = callerSourceOrigin();
```

---

## Microtasks

### `drainMicrotasks()`
Manually drains the microtask queue.

```js
import { drainMicrotasks } from "bun:jsc";
drainMicrotasks();
```

---

## Random Seed

### `getRandomSeed()`
Returns the current random seed used by the JSC engine.

```js
import { getRandomSeed } from "bun:jsc";
const seed = getRandomSeed();
```

### `setRandomSeed()`
Sets the random seed for the JSC engine's random number generator.

```js
import { setRandomSeed } from "bun:jsc";
setRandomSeed(12345);
```

---

## Timezone

### `setTimeZone()`
Overrides the timezone used by the JavaScript runtime for `Date` operations.

```js
import { setTimeZone } from "bun:jsc";
setTimeZone("America/New_York");
```

---

## Remote Debugging

### `startRemoteDebugger()`
Starts a remote debugger connection for the JSC engine.

```js
import { startRemoteDebugger } from "bun:jsc";
startRemoteDebugger();
```

---

## Complete Function List

| Function | Description |
|----------|-------------|
| `callerSourceOrigin()` | Returns the source origin of the calling code |
| `deserialize()` | Deserializes a previously serialized JavaScript value |
| `drainMicrotasks()` | Manually drains the microtask queue |
| `edenGC()` | Triggers an Eden (young generation) GC cycle |
| `estimateShallowMemoryUsageOf()` | Estimates shallow memory usage of an object |
| `fullGC()` | Triggers a full garbage collection cycle |
| `gcAndSweep()` | Triggers GC followed by a sweep |
| `getProtectedObjects()` | Returns objects protected from GC |
| `getRandomSeed()` | Returns the current JSC random seed |
| `heapSize()` | Returns current heap size in bytes |
| `heapStats()` | Returns detailed heap statistics |
| `isRope()` | Checks if a string is a rope (lazy concat) |
| `jscDescribe()` | Returns JSC internal description of a value |
| `jscDescribeArray()` | Returns JSC internal description of an array |
| `memoryUsage()` | Returns detailed memory usage info |
| `noFTL()` | Disables FTL JIT compilation |
| `noOSRExitFuzzing()` | Disables OSR exit fuzzing |
| `numberOfDFGCompiles()` | Returns number of DFG JIT compilations |
| `optimizeNextInvocation()` | Triggers JIT optimization for next call |
| `profile()` | Returns a sampling profile result |
| `releaseWeakRefs()` | Releases processed WeakRef targets |
| `reoptimizationRetryCount()` | Returns JIT reoptimization retry count |
| `serialize()` | Serializes a value to ArrayBuffer |
| `setRandomSeed()` | Sets the JSC random seed |
| `setTimeZone()` | Overrides the runtime timezone |
| `startRemoteDebugger()` | Starts a remote debugger connection |
| `startSamplingProfiler()` | Starts a sampling profiler |
| `totalCompileTime()` | Returns total JIT compilation time |
