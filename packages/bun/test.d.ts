// bun:test type definitions (standalone, no vitest dependency)

interface MockFn {
  (...args: any[]): any;
  mock: {
    calls: any[][];
    instances: any[];
    results: { type: "return" | "throw"; value: any }[];
  };
  _isMockFunction: boolean;
  mockReturnValue(val: any): MockFn;
  mockReturnValueOnce(val: any): MockFn;
  mockImplementation(fn: (...args: any[]) => any): MockFn;
  mockImplementationOnce(fn: (...args: any[]) => any): MockFn;
  mockReset(): MockFn;
  mockClear(): MockFn;
  mockRestore(): MockFn;
}

interface MockSpy extends MockFn {
  _original: Function;
  _object: any;
  _method: string;
  mockRestore(): MockFn;
}

interface ExpectMatchers {
  toBe(expected: any): void;
  toEqual(expected: any): void;
  toStrictEqual(expected: any): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  toBeNull(): void;
  toBeUndefined(): void;
  toBeDefined(): void;
  toBeNaN(): void;
  toBeGreaterThan(n: number): void;
  toBeLessThan(n: number): void;
  toBeGreaterThanOrEqual(n: number): void;
  toBeLessThanOrEqual(n: number): void;
  toBeCloseTo(expected: number, precision?: number): void;
  toContain(item: any): void;
  toContainEqual(item: any): void;
  toHaveLength(len: number): void;
  toHaveProperty(path: string, val?: any): void;
  toMatch(pattern: RegExp | string): void;
  toThrow(msg?: string | RegExp): void;
  toBeInstanceOf(cls: Function): void;
  toBeTypeOf(type: string): void;
  // Mock matchers
  toHaveBeenCalled(): void;
  toHaveBeenCalledTimes(n: number): void;
  toHaveBeenCalledWith(...args: any[]): void;
  toBeCalledWith(...args: any[]): void;
  toHaveBeenLastCalledWith(...args: any[]): void;
  toHaveBeenNthCalledWith(n: number, ...args: any[]): void;
  toHaveReturnedWith(val: any): void;
  toHaveLastReturnedWith(val: any): void;
  toHaveNthReturnedWith(n: number, val: any): void;
  toHaveReturnedTimes(n: number): void;
  not: ExpectMatchers;
}

export const test: {
  (name: string, fn: () => void | Promise<void>, timeout?: number): void;
  (name: string, opts: { timeout?: number }, fn: () => void | Promise<void>): void;
  skip: typeof test;
  only: typeof test;
  todo: (name: string) => void;
  each: <T>(cases: T[]) => (name: string, fn: (...args: T[]) => void | Promise<void>) => void;
  concurrent: typeof test;
  serial: typeof test;
  failing: typeof test;
  failing: { each: typeof test.each };
  retry: (count: number) => typeof test;
};

export const describe: {
  (name: string, fn: () => void): void;
  skip: typeof describe;
  only: typeof describe;
  todo: (name: string) => void;
  each: <T>(cases: T[]) => (name: string, fn: (...args: T[]) => void) => void;
};

export function expect(actual: any): ExpectMatchers;

export const jest: {
  fn: (implementation?: Function) => MockFn;
  spyOn: (object: any, method: string) => MockSpy;
  mock: (moduleName: string, factory?: () => any) => void;
  unmock: (moduleName: string) => void;
  clearAllMocks: () => void;
  resetAllMocks: () => void;
  restoreAllMocks: () => void;
  useFakeTimers: () => void;
  useRealTimers: () => void;
  advanceTimersByTime: (ms: number) => void;
  advanceTimersToNextTimer: () => void;
  runAllTimers: () => void;
  getTimerCount: () => number;
  setSystemTime: (time: Date | number) => void;
};

export const mock: typeof jest.fn;
export const vi: typeof jest;
export function setSystemTime(time: Date | number): void;
export function beforeAll(fn: () => void | Promise<void>): void;
export function beforeEach(fn: () => void | Promise<void>): void;
export function afterAll(fn: () => void | Promise<void>): void;
export function afterEach(fn: () => void | Promise<void>): void;

declare const _default: {
  test: typeof test;
  describe: typeof describe;
  expect: typeof expect;
  jest: typeof jest;
  mock: typeof mock;
  setSystemTime: typeof setSystemTime;
  vi: typeof vi;
  beforeAll: typeof beforeAll;
  beforeEach: typeof beforeEach;
  afterAll: typeof afterAll;
  afterEach: typeof afterEach;
};
export default _default;
