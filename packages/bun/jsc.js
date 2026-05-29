// bun:jsc — JavaScriptCore internals shim
// Maps JSC APIs to V8 equivalents where possible

import v8 from "node:v8";

// --- Heap & Memory ---

function heapSize() {
  return process.memoryUsage().heapUsed;
}

function heapStats() {
  const v8Stats = v8.getHeapStatistics();
  return {
    heapSize: v8Stats.total_heap_size,
    heapCapacity: v8Stats.heap_size_limit,
    heapUsed: v8Stats.used_heap_size,
    externalMemory: v8Stats.external_memory,
    objectCount: v8Stats.number_of_native_contexts,
    protectedObjectCount: v8Stats.number_of_detached_contexts,
  };
}

function memoryUsage() {
  const usage = process.memoryUsage();
  return {
    rss: usage.rss,
    heapTotal: usage.heapTotal,
    heapUsed: usage.heapUsed,
    external: usage.external,
    arrayBuffers: usage.arrayBuffers,
  };
}

function estimateShallowMemoryUsageOf(obj) {
  if (obj === null || obj === undefined) return 0;
  if (typeof obj === "boolean") return 4;
  if (typeof obj === "number") return 8;
  if (typeof obj === "string") return obj.length * 2 + 16;
  if (typeof obj === "symbol") return 0;
  if (typeof obj === "function") return 64;
  if (Buffer.isBuffer(obj)) return obj.length + 64;
  if (obj instanceof ArrayBuffer) return obj.byteLength + 64;
  if (ArrayBuffer.isView(obj)) return obj.byteLength + 64;
  if (Array.isArray(obj)) return obj.length * 8 + 32;
  if (typeof obj === "object") {
    return Object.keys(obj).length * 64 + 32;
  }
  return 0;
}

// --- Serialization ---

function serialize(value) {
  const buf = v8.serialize(value);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

function deserialize(buffer) {
  return v8.deserialize(Buffer.from(buffer));
}

// --- Garbage Collection ---

function fullGC() {
  if (globalThis.gc) globalThis.gc();
}

function edenGC() {
  if (globalThis.gc) globalThis.gc();
}

function gcAndSweep() {
  if (globalThis.gc) globalThis.gc();
}

function releaseWeakRefs() {
  // V8 handles WeakRef cleanup automatically
}

function getProtectedObjects() {
  return [];
}

// --- Profiling ---

function startSamplingProfiler() {
  // V8 sampling profiler is started via --prof flag
}

function profile() {
  return { samples: [], timestamps: [], stackFrames: {} };
}

function totalCompileTime() {
  return 0;
}

function numberOfDFGCompiles() {
  return 0;
}

function reoptimizationRetryCount() {
  return 0;
}

// --- JIT Control ---

function optimizeNextInvocation() {
  // V8 doesn't expose this directly
}

function noFTL() {
  // FTL is JSC-specific; V8's equivalent is TurboFan
}

function noOSRExitFuzzing() {
  // JSC-specific
}

// --- Debugging & Inspection ---

function jscDescribe(obj) {
  if (obj === null) return "null";
  if (obj === undefined) return "undefined";
  if (typeof obj === "string") return `String(${JSON.stringify(obj)})`;
  if (typeof obj === "number") return `Number(${obj})`;
  if (typeof obj === "boolean") return `Boolean(${obj})`;
  if (typeof obj === "function") return `Function(${obj.name || "anonymous"})`;
  if (Array.isArray(obj)) return `Array(${obj.length})`;
  return `Object(${Object.keys(obj).length} properties)`;
}

function jscDescribeArray(arr) {
  if (!Array.isArray(arr)) return "Not an array";
  return `Array(${arr.length}) [${arr.map(jscDescribe).join(", ")}]`;
}

function isRope(str) {
  return false; // V8 doesn't expose rope strings
}

function callerSourceOrigin() {
  const err = new Error();
  const stack = err.stack?.split("\n") || [];
  const callerLine = stack[3] || stack[2] || "";
  const match = callerLine.match(/at (?:.*\()?(.+?)(?::\d+:\d+)?\)?$/);
  return match ? match[1] : "unknown";
}

// --- Microtasks ---

function drainMicrotasks() {
  // V8 processes microtasks automatically
}

// --- Random Seed ---

function getRandomSeed() {
  return 0;
}

function setRandomSeed(seed) {
  // V8 doesn't expose random seed control
}

// --- Timezone ---

function setTimeZone(tz) {
  process.env.TZ = tz;
}

// --- Remote Debugging ---

function startRemoteDebugger(options = {}) {
  // V8 inspector is started via --inspect flag
}

// --- Exports ---

export {
  heapSize, heapStats, memoryUsage, estimateShallowMemoryUsageOf,
  serialize, deserialize,
  fullGC, edenGC, gcAndSweep, releaseWeakRefs, getProtectedObjects,
  startSamplingProfiler, profile, totalCompileTime, numberOfDFGCompiles, reoptimizationRetryCount,
  optimizeNextInvocation, noFTL, noOSRExitFuzzing,
  jscDescribe, jscDescribeArray, isRope, callerSourceOrigin,
  drainMicrotasks,
  getRandomSeed, setRandomSeed,
  setTimeZone,
  startRemoteDebugger,
};

export default {
  heapSize, heapStats, memoryUsage, estimateShallowMemoryUsageOf,
  serialize, deserialize,
  fullGC, edenGC, gcAndSweep, releaseWeakRefs, getProtectedObjects,
  startSamplingProfiler, profile, totalCompileTime, numberOfDFGCompiles, reoptimizationRetryCount,
  optimizeNextInvocation, noFTL, noOSRExitFuzzing,
  jscDescribe, jscDescribeArray, isRope, callerSourceOrigin,
  drainMicrotasks,
  getRandomSeed, setRandomSeed,
  setTimeZone,
  startRemoteDebugger,
};
