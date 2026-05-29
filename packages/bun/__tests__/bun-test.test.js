import { describe, it, expect } from "vitest";
import bunTest from "../test.js";
import {
  test as bunTest2,
  describe as bunDescribe,
  expect as bunExpect,
  jest,
  mock,
  setSystemTime,
  vi,
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
} from "../test.js";

// --- Exports ---

describe("bun:test exports", () => {
  it("exports test function", () => {
    expect(typeof bunTest2).toBe("function");
  });

  it("exports describe function", () => {
    expect(typeof bunDescribe).toBe("function");
  });

  it("exports expect function", () => {
    expect(typeof bunExpect).toBe("function");
  });

  it("exports jest object", () => {
    expect(typeof jest).toBe("object");
    expect(typeof jest.fn).toBe("function");
    expect(typeof jest.spyOn).toBe("function");
    expect(typeof jest.mock).toBe("function");
    expect(typeof jest.clearAllMocks).toBe("function");
    expect(typeof jest.resetAllMocks).toBe("function");
    expect(typeof jest.restoreAllMocks).toBe("function");
    expect(typeof jest.useFakeTimers).toBe("function");
    expect(typeof jest.useRealTimers).toBe("function");
  });

  it("exports mock function", () => {
    expect(typeof mock).toBe("function");
  });

  it("exports vi object", () => {
    expect(typeof vi).toBe("object");
    expect(typeof vi.fn).toBe("function");
  });

  it("exports lifecycle hooks", () => {
    expect(typeof beforeAll).toBe("function");
    expect(typeof beforeEach).toBe("function");
    expect(typeof afterAll).toBe("function");
    expect(typeof afterEach).toBe("function");
  });

  it("default export has all members", () => {
    expect(typeof bunTest.test).toBe("function");
    expect(typeof bunTest.describe).toBe("function");
    expect(typeof bunTest.expect).toBe("function");
    expect(typeof bunTest.jest).toBe("object");
    expect(typeof bunTest.mock).toBe("function");
    expect(typeof bunTest.setSystemTime).toBe("function");
    expect(typeof bunTest.vi).toBe("object");
  });
});

// --- test methods ---

describe("test function methods", () => {
  it("has all chain methods", () => {
    expect(typeof bunTest2.skip).toBe("function");
    expect(typeof bunTest2.todo).toBe("function");
    expect(typeof bunTest2.only).toBe("function");
    expect(typeof bunTest2.each).toBe("function");
    expect(typeof bunTest2.concurrent).toBe("function");
    expect(typeof bunTest2.serial).toBe("function");
    expect(typeof bunTest2.failing).toBe("function");
    expect(typeof bunTest2.retry).toBe("function");
  });
});

// --- describe methods ---

describe("describe function methods", () => {
  it("has all chain methods", () => {
    expect(typeof bunDescribe.skip).toBe("function");
    expect(typeof bunDescribe.only).toBe("function");
    expect(typeof bunDescribe.todo).toBe("function");
    expect(typeof bunDescribe.each).toBe("function");
  });
});

// --- jest.fn mock behavior (uses bunExpect for mock matchers) ---

describe("jest.fn mock behavior", () => {
  it("creates a mock that returns a value", () => {
    const fn = jest.fn(() => 42);
    bunExpect(fn()).toBe(42);
    bunExpect(fn).toHaveBeenCalled();
  });

  it("tracks call count", () => {
    const fn = jest.fn((x) => x * 2);
    fn(1);
    fn(2);
    fn(3);
    bunExpect(fn).toHaveBeenCalledTimes(3);
  });

  it("tracks call arguments", () => {
    const fn = jest.fn();
    fn("hello", 123);
    bunExpect(fn).toHaveBeenCalledWith("hello", 123);
  });

  it("tracks multiple calls", () => {
    const fn = jest.fn((x) => x);
    fn("a");
    fn("b");
    fn("c");
    bunExpect(fn.mock.calls).toEqual([["a"], ["b"], ["c"]]);
    bunExpect(fn.mock.results).toEqual([
      { type: "return", value: "a" },
      { type: "return", value: "b" },
      { type: "return", value: "c" },
    ]);
  });

  it("mockReturnValue sets return value", () => {
    const fn = jest.fn().mockReturnValue(99);
    bunExpect(fn()).toBe(99);
  });

  it("mockReturnValueOnce returns once then falls back", () => {
    const fn = jest.fn()
      .mockReturnValueOnce("first")
      .mockReturnValue("default");
    bunExpect(fn()).toBe("first");
    bunExpect(fn()).toBe("default");
    bunExpect(fn()).toBe("default");
  });

  it("mockImplementation sets implementation", () => {
    const fn = jest.fn().mockImplementation((a, b) => a + b);
    bunExpect(fn(2, 3)).toBe(5);
  });

  it("mockImplementationOnce sets one-shot implementation", () => {
    const fn = jest.fn()
      .mockImplementationOnce(() => "once")
      .mockImplementation(() => "always");
    bunExpect(fn()).toBe("once");
    bunExpect(fn()).toBe("always");
    bunExpect(fn()).toBe("always");
  });

  it("mockReset clears all state", () => {
    const fn = jest.fn(() => 42);
    fn("test");
    fn.mockReset();
    bunExpect(fn.mock.calls.length).toBe(0);
    bunExpect(fn()).toBeUndefined();
  });

  it("mockClear clears calls but keeps implementation", () => {
    const fn = jest.fn(() => 42);
    fn("test");
    fn.mockClear();
    bunExpect(fn.mock.calls.length).toBe(0);
    bunExpect(fn()).toBe(42);
  });

  it("mockRestore on spyOn restores original", () => {
    const obj = { greet: () => "hello" };
    const spy = jest.spyOn(obj, "greet").mockReturnValue("mocked");
    bunExpect(obj.greet()).toBe("mocked");
    spy.mockRestore();
    bunExpect(obj.greet()).toBe("hello");
  });

  it("mock.instances tracks instances for new calls", () => {
    const Fn = jest.fn();
    const a = new Fn();
    const b = new Fn();
    bunExpect(Fn.mock.instances.length).toBe(2);
  });

  it("toBeCalledWith works", () => {
    const fn = jest.fn();
    fn(42, "test");
    bunExpect(fn).toBeCalledWith(42, "test");
  });

  it("toHaveBeenLastCalledWith works", () => {
    const fn = jest.fn();
    fn("first");
    fn("second");
    bunExpect(fn).toHaveBeenLastCalledWith("second");
  });

  it("toHaveBeenNthCalledWith works", () => {
    const fn = jest.fn();
    fn("a");
    fn("b");
    fn("c");
    bunExpect(fn).toHaveBeenNthCalledWith(2, "b");
  });

  it("toHaveReturnedWith works", () => {
    const fn = jest.fn(() => 42);
    fn();
    bunExpect(fn).toHaveReturnedWith(42);
  });

  it("toHaveLastReturnedWith works", () => {
    const fn = jest.fn()
      .mockReturnValueOnce(1)
      .mockReturnValue(2);
    fn();
    fn();
    bunExpect(fn).toHaveLastReturnedWith(2);
  });

  it("toHaveNthReturnedWith works", () => {
    const fn = jest.fn()
      .mockReturnValueOnce("a")
      .mockReturnValueOnce("b")
      .mockReturnValue("c");
    fn();
    fn();
    fn();
    bunExpect(fn).toHaveNthReturnedWith(2, "b");
  });

  it("toHaveReturnedTimes checks call count", () => {
    const fn = jest.fn(() => 1);
    fn();
    fn();
    bunExpect(fn).toHaveReturnedTimes(2);
  });
});

// --- mock (alias for jest.fn) ---

describe("mock alias", () => {
  it("creates a mock function", () => {
    const fn = mock(() => "hello");
    bunExpect(fn()).toBe("hello");
    bunExpect(fn).toHaveBeenCalled();
  });
});

// --- expect matchers (uses bunExpect) ---

describe("expect matchers (via bunExpect)", () => {
  it("toBe uses Object.is", () => {
    bunExpect(1 + 1).toBe(2);
    bunExpect(NaN).toBe(NaN);
    bunExpect(0).not.toBe(-0);
  });

  it("toEqual does deep equality", () => {
    bunExpect({ a: 1, b: [2, 3] }).toEqual({ a: 1, b: [2, 3] });
    bunExpect([1, { a: 2 }]).toEqual([1, { a: 2 }]);
  });

  it("toStrictEqual checks type equality", () => {
    bunExpect({ a: 1, b: undefined }).not.toStrictEqual({ a: 1 });
  });

  it("toBeTruthy / toBeFalsy", () => {
    bunExpect(1).toBeTruthy();
    bunExpect(0).toBeFalsy();
    bunExpect("").toBeFalsy();
    bunExpect(null).toBeFalsy();
  });

  it("toBeNull / toBeUndefined / toBeDefined", () => {
    bunExpect(null).toBeNull();
    bunExpect(undefined).toBeUndefined();
    bunExpect(0).toBeDefined();
  });

  it("toBeNaN", () => {
    bunExpect(NaN).toBeNaN();
    bunExpect(1).not.toBeNaN();
  });

  it("toBeGreaterThan / toBeLessThan", () => {
    bunExpect(10).toBeGreaterThan(5);
    bunExpect(3).toBeLessThan(5);
  });

  it("toBeGreaterThanOrEqual / toBeLessThanOrEqual", () => {
    bunExpect(5).toBeGreaterThanOrEqual(5);
    bunExpect(5).toBeLessThanOrEqual(5);
  });

  it("toBeCloseTo for floating point", () => {
    bunExpect(0.1 + 0.2).toBeCloseTo(0.3, 5);
  });

  it("toContain for arrays and strings", () => {
    bunExpect([1, 2, 3]).toContain(2);
    bunExpect("hello world").toContain("world");
  });

  it("toContainEqual for deep equality in arrays", () => {
    bunExpect([{ a: 1 }, { b: 2 }]).toContainEqual({ b: 2 });
  });

  it("toHaveLength", () => {
    bunExpect([1, 2, 3]).toHaveLength(3);
    bunExpect("hello").toHaveLength(5);
  });

  it("toHaveProperty", () => {
    bunExpect({ a: { b: 1 } }).toHaveProperty("a.b");
    bunExpect({ a: { b: 1 } }).toHaveProperty("a.b", 1);
  });

  it("toMatch for strings", () => {
    bunExpect("hello123").toMatch(/\d+/);
    bunExpect("hello").toMatch("ell");
  });

  it("toThrow", () => {
    bunExpect(() => {
      throw new Error("test error");
    }).toThrow("test error");
    bunExpect(() => {
      throw new Error("test");
    }).toThrow(/test/);
  });

  it("toBeInstanceOf", () => {
    bunExpect(new Date()).toBeInstanceOf(Date);
    bunExpect(new Error("x")).toBeInstanceOf(Error);
  });

  it("toBeTypeOf", () => {
    bunExpect("hello").toBeTypeOf("string");
    bunExpect(42).toBeTypeOf("number");
  });
});

// --- test.each ---

describe("test.each", () => {
  it("each returns a function", () => {
    const eachFn = bunTest2.each([1, 2, 3]);
    expect(typeof eachFn).toBe("function");
  });
});

// --- describe.each ---

describe("describe.each", () => {
  it("each returns a function", () => {
    const eachFn = bunDescribe.each([1, 2, 3]);
    expect(typeof eachFn).toBe("function");
  });
});

// --- lifecycle hooks ---

describe("lifecycle hooks", () => {
  it("beforeAll is a function", () => {
    expect(typeof beforeAll).toBe("function");
  });

  it("beforeEach is a function", () => {
    expect(typeof beforeEach).toBe("function");
  });

  it("afterAll is a function", () => {
    expect(typeof afterAll).toBe("function");
  });

  it("afterEach is a function", () => {
    expect(typeof afterEach).toBe("function");
  });
});

// --- setSystemTime ---

describe("setSystemTime", () => {
  it("is a function", () => {
    expect(typeof setSystemTime).toBe("function");
  });
});
