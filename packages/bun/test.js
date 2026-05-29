// bun:test — Standalone Jest-compatible test API
// Provides test, describe, expect, jest.fn, lifecycle hooks, and more

// --- Internal state ---

let _currentDescribe = null;
const _allDescribes = [];
const _testRegistry = [];

// --- jest.fn() mock implementation ---

function createMock(implementation) {
  const mockState = {
    calls: [],
    instances: [],
    results: [],
    implementation: implementation || (() => undefined),
    returnValues: [],
    implementations: [],
  };

  const fn = function (...args) {
    mockState.calls.push(args);
    const isConstructor = new.target !== undefined;
    let result;
    const impl = mockState.implementations.length > 0
      ? mockState.implementations.shift()
      : mockState.returnValues.length > 0
        ? () => mockState.returnValues.shift()
        : mockState.implementation;
    try {
      result = impl.apply(this, args);
      mockState.results.push({ type: "return", value: result });
    } catch (err) {
      mockState.results.push({ type: "throw", value: err });
      throw err;
    }
    if (isConstructor) {
      mockState.instances.push(this);
    }
    return result;
  };

  fn.mock = mockState;
  fn._isMockFunction = true;

  fn.mockReturnValue = (val) => {
    mockState.implementation = () => val;
    return fn;
  };

  fn.mockReturnValueOnce = (val) => {
    mockState.returnValues.push(val);
    return fn;
  };

  fn.mockImplementation = (impl) => {
    mockState.implementation = impl;
    return fn;
  };

  fn.mockImplementationOnce = (impl) => {
    mockState.implementations.push(impl);
    return fn;
  };

  fn.mockReset = () => {
    mockState.calls = [];
    mockState.instances = [];
    mockState.results = [];
    mockState.returnValues = [];
    mockState.implementations = [];
    mockState.implementation = () => undefined;
    return fn;
  };

  fn.mockClear = () => {
    mockState.calls = [];
    mockState.instances = [];
    mockState.results = [];
    return fn;
  };

  fn.mockRestore = () => {
    fn.mockClear();
    return fn;
  };

  return fn;
}

// --- jest.spyOn ---

function spyOn(object, method) {
  const original = object[method];
  const spy = createMock(function (...args) {
    return original.apply(this, args);
  });
  spy._original = original;
  spy._object = object;
  spy._method = method;
  object[method] = spy;
  spy.mockRestore = () => {
    object[method] = original;
    return spy;
  };
  return spy;
}

// --- jest namespace ---

const jest = {
  fn: createMock,
  spyOn,
  mock: (moduleName, factory) => { /* no-op for shim */ },
  unmock: (moduleName) => { /* no-op */ },
  clearAllMocks: () => { /* no-op */ },
  resetAllMocks: () => { /* no-op */ },
  restoreAllMocks: () => { /* no-op */ },
  useFakeTimers: () => { /* no-op */ },
  useRealTimers: () => { /* no-op */ },
  advanceTimersByTime: () => { /* no-op */ },
  advanceTimersToNextTimer: () => { /* no-op */ },
  runAllTimers: () => { /* no-op */ },
  getTimerCount: () => 0,
  setSystemTime: () => { /* no-op */ },
};

const mock = createMock;

// --- test function ---

function test(name, optsOrFn, maybeFn) {
  let opts = {};
  let fn;
  if (typeof optsOrFn === "function") {
    fn = optsOrFn;
  } else {
    opts = optsOrFn || {};
    fn = maybeFn;
  }
  _testRegistry.push({ name, fn, opts, describe: _currentDescribe });
}

test.skip = (name, fn) => _testRegistry.push({ name, fn: fn || (() => {}), opts: { skip: true }, describe: _currentDescribe });
test.todo = (name) => _testRegistry.push({ name, fn: () => {}, opts: { todo: true }, describe: _currentDescribe });
test.only = (name, fn) => _testRegistry.push({ name, fn, opts: { only: true }, describe: _currentDescribe });
test.each = (cases) => (nameFn, fn) => {
  for (const c of cases) {
    const name = typeof nameFn === "function" ? nameFn(c) : String(nameFn).replace("%s", String(c));
    _testRegistry.push({ name, fn: () => fn(c), opts: {}, describe: _currentDescribe });
  }
};
test.concurrent = (name, fn) => _testRegistry.push({ name, fn, opts: { concurrent: true }, describe: _currentDescribe });
test.serial = (name, fn) => _testRegistry.push({ name, fn, opts: { serial: true }, describe: _currentDescribe });
test.failing = (name, fn) => _testRegistry.push({ name, fn, opts: { failing: true }, describe: _currentDescribe });
test.failing.each = (cases) => (nameFn, fn) => test.each(cases)(nameFn, fn);
test.retry = (count) => (name, fn) => _testRegistry.push({ name, fn, opts: { retry: count }, describe: _currentDescribe });

// --- describe function ---

function describe(name, fn) {
  const parent = _currentDescribe;
  const desc = { name, parent, children: [], tests: [] };
  if (parent) parent.children.push(desc);
  else _allDescribes.push(desc);
  _currentDescribe = desc;
  fn();
  _currentDescribe = parent;
}

describe.skip = (name, fn) => { /* skip */ };
describe.only = (name, fn) => { /* only */ };
describe.todo = (name) => { /* todo */ };
describe.each = (cases) => (nameFn, fn) => {
  for (const c of cases) {
    const name = typeof nameFn === "function" ? nameFn(c) : String(nameFn).replace("%s", String(c));
    describe(name, () => fn(c));
  }
};

// --- expect ---

function expect(actual) {
  const not = {
    get toBe() { return (expected) => { if (Object.is(actual, expected)) throw new Error(`Expected ${JSON.stringify(actual)} not to be ${JSON.stringify(expected)}`); }; },
    get toEqual() { return (expected) => { if (deepEqual(actual, expected)) throw new Error(`Expected ${JSON.stringify(actual)} not to equal ${JSON.stringify(expected)}`); }; },
    get toBeTruthy() { return () => { if (actual) throw new Error(`Expected ${JSON.stringify(actual)} not to be truthy`); }; },
    get toBeFalsy() { return () => { if (!actual) throw new Error(`Expected ${JSON.stringify(actual)} not to be falsy`); }; },
    get toBeNull() { return () => { if (actual === null) throw new Error("Expected not to be null"); }; },
    get toBeUndefined() { return () => { if (actual === undefined) throw new Error("Expected not to be undefined"); }; },
    get toBeNaN() { return () => { if (Number.isNaN(actual)) throw new Error("Expected not to be NaN"); }; },
    get toBeGreaterThan() { return (n) => { if (actual <= n) throw new Error(`Expected ${actual} not to be greater than ${n}`); }; },
    get toBeLessThan() { return (n) => { if (actual >= n) throw new Error(`Expected ${actual} not to be less than ${n}`); }; },
    get toContain() { return (item) => { if (typeof actual === "string") { if (actual.includes(item)) throw new Error(`Expected "${actual}" not to contain "${item}"`); } else { if (actual.includes(item)) throw new Error(`Expected array not to contain ${item}`); } }; },
    get toThrow() { return (msg) => { try { actual(); throw new Error("Expected function to throw"); } catch (e) { if (msg && !e.message.includes(msg)) throw new Error(`Expected error message "${e.message}" not to contain "${msg}"`); } }; },
    get toHaveLength() { return (len) => { if (actual.length === len) throw new Error(`Expected length not to be ${len}`); }; },
    get toHaveProperty() { return (path, val) => { const parts = path.split("."); let obj = actual; for (const p of parts) { if (obj == null || !(p in obj)) return; obj = obj[p]; } if (val !== undefined && obj === val) throw new Error(`Expected not to have property ${path} = ${val}`); }; },
    get toMatch() { return (pattern) => { const re = pattern instanceof RegExp ? pattern : new RegExp(pattern); if (re.test(actual)) throw new Error(`Expected "${actual}" not to match ${re}`); }; },
    get toBeInstanceOf() { return (cls) => { if (actual instanceof cls) throw new Error(`Expected not to be instance of ${cls.name}`); }; },
    get toBeTypeOf() { return (type) => { if (typeof actual === type) throw new Error(`Expected not to be type ${type}`); }; },
    get toBeCloseTo() { return (expected, precision = 2) => { const pass = Math.abs(expected - actual) < Math.pow(10, -precision) / 2; if (pass) throw new Error(`Expected ${actual} not to be close to ${expected}`); }; },
    get toBeDefined() { return () => { if (actual !== undefined) throw new Error("Expected not to be defined"); }; },
    get toBeGreaterThanOrEqual() { return (n) => { if (actual < n) throw new Error(`Expected ${actual} not to be >= ${n}`); }; },
    get toBeLessThanOrEqual() { return (n) => { if (actual > n) throw new Error(`Expected ${actual} not to be <= ${n}`); }; },
    get toStrictEqual() { return (expected) => { if (strictDeepEqual(actual, expected)) throw new Error(`Expected not to strictly equal`); }; },
    get toContainEqual() { return (item) => { if (Array.isArray(actual) && actual.some((a) => deepEqual(a, item))) throw new Error(`Expected array not to contain equal`); }; },
    get toHaveBeenCalled() { return () => { if (actual._isMockFunction && actual.mock.calls.length > 0) throw new Error("Expected mock not to have been called"); }; },
    get toHaveBeenCalledTimes() { return (n) => { if (actual._isMockFunction && actual.mock.calls.length === n) throw new Error(`Expected mock not to have been called ${n} times`); }; },
    get toHaveBeenCalledWith() { return (...args) => { if (actual._isMockFunction && actual.mock.calls.some((c) => deepEqual(c, args))) throw new Error("Expected mock not to have been called with those args"); }; },
    get toHaveBeenLastCalledWith() { return (...args) => { if (actual._isMockFunction && actual.mock.calls.length > 0 && deepEqual(actual.mock.calls[actual.mock.calls.length - 1], args)) throw new Error("Expected last call not to match"); }; },
    get toHaveBeenNthCalledWith() { return (n, ...args) => { if (actual._isMockFunction && actual.mock.calls.length >= n && deepEqual(actual.mock.calls[n - 1], args)) throw new Error(`Expected call ${n} not to match`); }; },
    get toHaveReturnedWith() { return (val) => { if (actual._isMockFunction && actual.mock.results.some((r) => r.type === "return" && deepEqual(r.value, val))) throw new Error("Expected mock not to have returned that value"); }; },
    get toHaveLastReturnedWith() { return (val) => { const results = actual._isMockFunction ? actual.mock.results : []; if (results.length > 0 && results[results.length - 1].type === "return" && deepEqual(results[results.length - 1].value, val)) throw new Error("Expected last return not to match"); }; },
    get toHaveNthReturnedWith() { return (n, val) => { const results = actual._isMockFunction ? actual.mock.results : []; if (results.length >= n && results[n - 1].type === "return" && deepEqual(results[n - 1].value, val)) throw new Error(`Expected return ${n} not to match`); }; },
    get toHaveReturnedTimes() { return (n) => { if (actual._isMockFunction && actual.mock.results.length === n) throw new Error(`Expected mock not to have returned ${n} times`); }; },
  };

  return {
    get toBe() { return (expected) => { if (!Object.is(actual, expected)) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`); }; },
    get toEqual() { return (expected) => { if (!deepEqual(actual, expected)) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`); }; },
    get toStrictEqual() { return (expected) => { if (!strictDeepEqual(actual, expected)) throw new Error("Expected strict equality"); }; },
    get toBeTruthy() { return () => { if (!actual) throw new Error(`Expected truthy, received ${JSON.stringify(actual)}`); }; },
    get toBeFalsy() { return () => { if (actual) throw new Error(`Expected falsy, received ${JSON.stringify(actual)}`); }; },
    get toBeNull() { return () => { if (actual !== null) throw new Error(`Expected null, received ${JSON.stringify(actual)}`); }; },
    get toBeUndefined() { return () => { if (actual !== undefined) throw new Error(`Expected undefined, received ${JSON.stringify(actual)}`); }; },
    get toBeDefined() { return () => { if (actual === undefined) throw new Error("Expected defined"); }; },
    get toBeNaN() { return () => { if (!Number.isNaN(actual)) throw new Error(`Expected NaN, received ${actual}`); }; },
    get toBeGreaterThan() { return (n) => { if (actual <= n) throw new Error(`Expected ${actual} > ${n}`); }; },
    get toBeLessThan() { return (n) => { if (actual >= n) throw new Error(`Expected ${actual} < ${n}`); }; },
    get toBeGreaterThanOrEqual() { return (n) => { if (actual < n) throw new Error(`Expected ${actual} >= ${n}`); }; },
    get toBeLessThanOrEqual() { return (n) => { if (actual > n) throw new Error(`Expected ${actual} <= ${n}`); }; },
    get toBeCloseTo() { return (expected, precision = 2) => { const pass = Math.abs(expected - actual) < Math.pow(10, -precision) / 2; if (!pass) throw new Error(`Expected ${actual} to be close to ${expected}`); }; },
    get toContain() { return (item) => { if (typeof actual === "string") { if (!actual.includes(item)) throw new Error(`Expected "${actual}" to contain "${item}"`); } else if (Array.isArray(actual)) { if (!actual.includes(item)) throw new Error(`Expected array to contain ${item}`); } else throw new Error("toContain requires string or array"); }; },
    get toContainEqual() { return (item) => { if (!Array.isArray(actual) || !actual.some((a) => deepEqual(a, item))) throw new Error("Expected array to contain equal item"); }; },
    get toHaveLength() { return (len) => { if (actual.length !== len) throw new Error(`Expected length ${len}, received ${actual.length}`); }; },
    get toHaveProperty() { return (path, val) => { const parts = path.split("."); let obj = actual; for (const p of parts) { if (obj == null || !(p in obj)) throw new Error(`Expected property ${path}`); obj = obj[p]; } if (val !== undefined && !deepEqual(obj, val)) throw new Error(`Expected ${path} = ${JSON.stringify(val)}, received ${JSON.stringify(obj)}`); }; },
    get toMatch() { return (pattern) => { const re = pattern instanceof RegExp ? pattern : new RegExp(pattern); if (!re.test(actual)) throw new Error(`Expected "${actual}" to match ${re}`); }; },
    get toThrow() { return (msg) => { let threw = false; try { actual(); } catch (e) { threw = true; if (msg) { const match = typeof msg === "string" ? e.message.includes(msg) : msg.test(e.message); if (!match) throw new Error(`Expected error "${e.message}" to match ${msg}`); } } if (!threw) throw new Error("Expected function to throw"); }; },
    get toBeInstanceOf() { return (cls) => { if (!(actual instanceof cls)) throw new Error(`Expected instance of ${cls.name}`); }; },
    get toBeTypeOf() { return (type) => { if (typeof actual !== type) throw new Error(`Expected type ${type}, received ${typeof actual}`); }; },
    get toHaveBeenCalled() { return () => { if (!actual._isMockFunction) throw new Error("toBeCalled requires a mock"); if (actual.mock.calls.length === 0) throw new Error("Expected mock to have been called"); }; },
    get toHaveBeenCalledTimes() { return (n) => { if (!actual._isMockFunction) throw new Error("toBeCalledTimes requires a mock"); if (actual.mock.calls.length !== n) throw new Error(`Expected ${n} calls, received ${actual.mock.calls.length}`); }; },
    get toHaveBeenCalledWith() { return (...args) => { if (!actual._isMockFunction) throw new Error("toBeCalledWith requires a mock"); const found = actual.mock.calls.some((c) => deepEqual(c, args)); if (!found) throw new Error(`Expected mock called with ${JSON.stringify(args)}`); }; },
    get toHaveBeenLastCalledWith() { return (...args) => { const calls = actual._isMockFunction ? actual.mock.calls : []; if (calls.length === 0 || !deepEqual(calls[calls.length - 1], args)) throw new Error("Last call args mismatch"); }; },
    get toHaveBeenNthCalledWith() { return (n, ...args) => { const calls = actual._isMockFunction ? actual.mock.calls : []; if (calls.length < n || !deepEqual(calls[n - 1], args)) throw new Error(`Call ${n} args mismatch`); }; },
    get toHaveReturnedWith() { return (val) => { const results = actual._isMockFunction ? actual.mock.results : []; if (!results.some((r) => r.type === "return" && deepEqual(r.value, val))) throw new Error("No matching return value"); }; },
    get toHaveLastReturnedWith() { return (val) => { const results = actual._isMockFunction ? actual.mock.results : []; if (results.length === 0 || !deepEqual(results[results.length - 1].value, val)) throw new Error("Last return mismatch"); }; },
    get toHaveNthReturnedWith() { return (n, val) => { const results = actual._isMockFunction ? actual.mock.results : []; if (results.length < n || !deepEqual(results[n - 1].value, val)) throw new Error(`Return ${n} mismatch`); }; },
    get toHaveReturnedTimes() { return (n) => { const count = actual._isMockFunction ? actual.mock.results.filter((r) => r.type === "return").length : 0; if (count !== n) throw new Error(`Expected ${n} returns, received ${count}`); }; },
    // Aliases
    get toBeCalledWith() { return (...args) => { if (!actual._isMockFunction) throw new Error("toBeCalledWith requires a mock"); const found = actual.mock.calls.some((c) => deepEqual(c, args)); if (!found) throw new Error(`Expected mock called with ${JSON.stringify(args)}`); }; },
    get toBeCalled() { return () => { if (!actual._isMockFunction) throw new Error("toBeCalled requires a mock"); if (actual.mock.calls.length === 0) throw new Error("Expected mock to have been called"); }; },
    get toBeCalledTimes() { return (n) => { if (!actual._isMockFunction) throw new Error("toBeCalledTimes requires a mock"); if (actual.mock.calls.length !== n) throw new Error(`Expected ${n} calls, received ${actual.mock.calls.length}`); }; },
    get toReturn() { return () => { if (!actual._isMockFunction) throw new Error("toReturn requires a mock"); if (actual.mock.results.filter((r) => r.type === "return").length === 0) throw new Error("Expected mock to have returned"); }; },
    get toReturnWith() { return (val) => { const results = actual._isMockFunction ? actual.mock.results : []; if (!results.some((r) => r.type === "return" && deepEqual(r.value, val))) throw new Error("No matching return value"); }; },
    get toReturnTimes() { return (n) => { const count = actual._isMockFunction ? actual.mock.results.filter((r) => r.type === "return").length : 0; if (count !== n) throw new Error(`Expected ${n} returns, received ${count}`); }; },
    not,
  };
}

function deepEqual(a, b, seen) {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || a === undefined || b === undefined) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return false;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof RegExp && b instanceof RegExp) return a.toString() === b.toString();
  // Cycle detection
  if (!seen) seen = new WeakMap();
  if (seen.has(a)) return seen.get(a) === b;
  seen.set(a, b);
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqual(a[key], b[key], seen)) return false;
  }
  return true;
}

function strictDeepEqual(a, b, seen) {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== "object") return false;
  // Cycle detection
  if (!seen) seen = new WeakMap();
  if (seen.has(a)) return seen.get(a) === b;
  seen.set(a, b);
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!strictDeepEqual(a[key], b[key], seen)) return false;
  }
  return true;
}

// --- Lifecycle hooks ---

function beforeAll(fn) { /* registered via test runner */ }
function beforeEach(fn) { /* registered via test runner */ }
function afterAll(fn) { /* registered via test runner */ }
function afterEach(fn) { /* registered via test runner */ }

// --- setSystemTime ---

function setSystemTime() { /* no-op for shim */ }

// --- vi (alias for jest, for Bun compat) ---

const vi = jest;

// --- Exports ---

export {
  test,
  describe,
  expect,
  jest,
  mock,
  vi,
  setSystemTime,
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
};

export default {
  test,
  describe,
  expect,
  jest,
  mock,
  vi,
  setSystemTime,
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
};
