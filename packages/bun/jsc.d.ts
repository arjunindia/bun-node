// bun:jsc type definitions

export interface HeapStats {
  heapSize: number;
  heapCapacity: number;
  heapUsed: number;
  externalMemory: number;
  objectCount: number;
  protectedObjectCount: number;
}

export interface MemoryUsage {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
}

export interface SamplingProfile {
  samples: any[];
  timestamps: number[];
  stackFrames: Record<string, any>;
}

// Heap & Memory
export function heapSize(): number;
export function heapStats(): HeapStats;
export function memoryUsage(): MemoryUsage;
export function estimateShallowMemoryUsageOf(obj: any): number;

// Serialization
export function serialize(value: any): ArrayBuffer;
export function deserialize(buffer: ArrayBufferLike): any;

// Garbage Collection
export function fullGC(): void;
export function edenGC(): void;
export function gcAndSweep(): void;
export function releaseWeakRefs(): void;
export function getProtectedObjects(): any[];

// Profiling
export function startSamplingProfiler(): void;
export function profile(): SamplingProfile;
export function totalCompileTime(): number;
export function numberOfDFGCompiles(): number;
export function reoptimizationRetryCount(): number;

// JIT Control
export function optimizeNextInvocation(): void;
export function noFTL(): void;
export function noOSRExitFuzzing(): void;

// Debugging & Inspection
export function jscDescribe(obj: any): string;
export function jscDescribeArray(arr: any[]): string;
export function isRope(str: string): boolean;
export function callerSourceOrigin(): string;

// Microtasks
export function drainMicrotasks(): void;

// Random Seed
export function getRandomSeed(): number;
export function setRandomSeed(seed: number): void;

// Timezone
export function setTimeZone(tz: string): void;

// Remote Debugging
export function startRemoteDebugger(options?: { port?: number }): void;
