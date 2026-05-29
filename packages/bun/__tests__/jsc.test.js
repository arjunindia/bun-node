import { describe, it, expect } from "vitest";
import {
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
} from "../jsc.js";

// --- Heap & Memory ---

describe("heapSize", () => {
  it("returns a number", () => {
    expect(typeof heapSize()).toBe("number");
    expect(heapSize()).toBeGreaterThan(0);
  });
});

describe("heapStats", () => {
  it("returns heap statistics", () => {
    const stats = heapStats();
    expect(stats).toHaveProperty("heapSize");
    expect(stats).toHaveProperty("heapCapacity");
    expect(stats).toHaveProperty("heapUsed");
    expect(typeof stats.heapSize).toBe("number");
  });
});

describe("memoryUsage", () => {
  it("returns memory usage info", () => {
    const usage = memoryUsage();
    expect(usage).toHaveProperty("rss");
    expect(usage).toHaveProperty("heapTotal");
    expect(usage).toHaveProperty("heapUsed");
    expect(usage).toHaveProperty("external");
    expect(usage).toHaveProperty("arrayBuffers");
    expect(typeof usage.rss).toBe("number");
  });
});

describe("estimateShallowMemoryUsageOf", () => {
  it("returns 0 for null", () => {
    expect(estimateShallowMemoryUsageOf(null)).toBe(0);
  });

  it("returns 0 for undefined", () => {
    expect(estimateShallowMemoryUsageOf(undefined)).toBe(0);
  });

  it("returns a number for strings", () => {
    expect(estimateShallowMemoryUsageOf("hello")).toBeGreaterThan(0);
  });

  it("returns a number for objects", () => {
    expect(estimateShallowMemoryUsageOf({ foo: "bar" })).toBeGreaterThan(0);
  });

  it("returns a number for arrays", () => {
    expect(estimateShallowMemoryUsageOf([1, 2, 3])).toBeGreaterThan(0);
  });

  it("returns a number for numbers", () => {
    expect(estimateShallowMemoryUsageOf(42)).toBeGreaterThan(0);
  });
});

// --- Serialization ---

describe("serialize / deserialize", () => {
  it("round-trips an object", () => {
    const obj = { foo: "bar", num: 42 };
    const buf = serialize(obj);
    expect(buf).toBeInstanceOf(ArrayBuffer);
    const result = deserialize(buf);
    expect(result).toEqual(obj);
  });

  it("round-trips an array", () => {
    const arr = [1, 2, 3, "hello"];
    const buf = serialize(arr);
    const result = deserialize(buf);
    expect(result).toEqual(arr);
  });

  it("round-trips nested objects", () => {
    const obj = { a: { b: { c: 1 } } };
    const buf = serialize(obj);
    const result = deserialize(buf);
    expect(result).toEqual(obj);
  });

  it("round-trips primitives", () => {
    const buf = serialize(42);
    expect(deserialize(buf)).toBe(42);

    const buf2 = serialize("hello");
    expect(deserialize(buf2)).toBe("hello");

    const buf3 = serialize(true);
    expect(deserialize(buf3)).toBe(true);

    const buf4 = serialize(null);
    expect(deserialize(buf4)).toBe(null);
  });
});

// --- Garbage Collection ---

describe("GC functions", () => {
  it("fullGC does not throw", () => {
    expect(() => fullGC()).not.toThrow();
  });

  it("edenGC does not throw", () => {
    expect(() => edenGC()).not.toThrow();
  });

  it("gcAndSweep does not throw", () => {
    expect(() => gcAndSweep()).not.toThrow();
  });

  it("releaseWeakRefs does not throw", () => {
    expect(() => releaseWeakRefs()).not.toThrow();
  });

  it("getProtectedObjects returns array", () => {
    expect(Array.isArray(getProtectedObjects())).toBe(true);
  });
});

// --- Profiling ---

describe("profiling", () => {
  it("startSamplingProfiler does not throw", () => {
    expect(() => startSamplingProfiler()).not.toThrow();
  });

  it("profile returns an object", () => {
    const result = profile();
    expect(result).toHaveProperty("samples");
    expect(Array.isArray(result.samples)).toBe(true);
  });

  it("totalCompileTime returns a number", () => {
    expect(typeof totalCompileTime()).toBe("number");
  });

  it("numberOfDFGCompiles returns a number", () => {
    expect(typeof numberOfDFGCompiles()).toBe("number");
  });

  it("reoptimizationRetryCount returns a number", () => {
    expect(typeof reoptimizationRetryCount()).toBe("number");
  });
});

// --- JIT Control ---

describe("JIT control", () => {
  it("optimizeNextInvocation does not throw", () => {
    expect(() => optimizeNextInvocation()).not.toThrow();
  });

  it("noFTL does not throw", () => {
    expect(() => noFTL()).not.toThrow();
  });

  it("noOSRExitFuzzing does not throw", () => {
    expect(() => noOSRExitFuzzing()).not.toThrow();
  });
});

// --- Debugging ---

describe("jscDescribe", () => {
  it("describes null", () => {
    expect(jscDescribe(null)).toBe("null");
  });

  it("describes undefined", () => {
    expect(jscDescribe(undefined)).toBe("undefined");
  });

  it("describes a string", () => {
    expect(jscDescribe("hello")).toContain("String");
  });

  it("describes a number", () => {
    expect(jscDescribe(42)).toContain("Number");
  });

  it("describes a boolean", () => {
    expect(jscDescribe(true)).toContain("Boolean");
  });

  it("describes a function", () => {
    expect(jscDescribe(() => {})).toContain("Function");
  });

  it("describes an array", () => {
    expect(jscDescribe([1, 2, 3])).toContain("Array");
  });

  it("describes an object", () => {
    expect(jscDescribe({ a: 1, b: 2 })).toContain("Object");
  });
});

describe("jscDescribeArray", () => {
  it("describes an array", () => {
    const result = jscDescribeArray([1, 2, 3]);
    expect(result).toContain("Array(3)");
  });

  it("returns error for non-array", () => {
    expect(jscDescribeArray("hello")).toBe("Not an array");
  });
});

describe("isRope", () => {
  it("returns false for a string", () => {
    expect(isRope("hello")).toBe(false);
  });

  it("returns false for concatenated string", () => {
    expect(isRope("hello" + "world")).toBe(false);
  });
});

describe("callerSourceOrigin", () => {
  it("returns a string", () => {
    const origin = callerSourceOrigin();
    expect(typeof origin).toBe("string");
  });
});

// --- Microtasks ---

describe("drainMicrotasks", () => {
  it("does not throw", () => {
    expect(() => drainMicrotasks()).not.toThrow();
  });
});

// --- Random Seed ---

describe("random seed", () => {
  it("getRandomSeed returns a number", () => {
    expect(typeof getRandomSeed()).toBe("number");
  });

  it("setRandomSeed does not throw", () => {
    expect(() => setRandomSeed(12345)).not.toThrow();
  });
});

// --- Timezone ---

describe("setTimeZone", () => {
  it("does not throw", () => {
    expect(() => setTimeZone("America/New_York")).not.toThrow();
  });
});

// --- Remote Debugging ---

describe("startRemoteDebugger", () => {
  it("does not throw", () => {
    expect(() => startRemoteDebugger()).not.toThrow();
  });
});
