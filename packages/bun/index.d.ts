// buniso — Bun-compatible API for Node.js
// Type definitions

export * from "./sqlite.js";
export * from "./ffi.js";
export * from "./test.js";
export * from "./jsc.js";
export * from "./glob.js";
export * from "./semver.js";
export * from "./toml.js";
export * from "./markdown.js";
export * from "./color.js";
export * from "./image.js";
export * from "./cookies.js";
export * from "./csrf.js";
export * from "./transpiler.js";
export * from "./workers.js";
export * from "./spawn.js";
export * from "./shell.js";
export * from "./sql.js";

// bun:test re-exports
export { test, describe, expect, jest, mock, vi, setSystemTime, beforeAll, beforeEach, afterAll, afterEach } from "./test.js";

// --- File I/O ---

export class BunFile extends Blob {
  readonly size: number;
  readonly type: string;
  exists(): Promise<boolean>;
  text(): Promise<string>;
  json(): Promise<any>;
  arrayBuffer(): Promise<ArrayBuffer>;
  bytes(): Promise<Uint8Array>;
  stream(): ReadableStream;
  writer(options?: { highWaterMark?: number }): FileSink;
  delete(): Promise<void>;
}

export class FileSink {
  write(chunk: string | ArrayBuffer | ArrayBufferView): number;
  flush(): number;
  end(): number;
  ref(): void;
  unref(): void;
}

export function file(path: string | URL, options?: { type?: string }): BunFile;
export function write(destination: string | URL | BunFile, input: string | Blob | ArrayBuffer | ArrayBufferView | Response): Promise<number>;

export const stdin: BunFile;
export const stdout: BunFile;
export const stderr: BunFile;

// --- Properties ---

export const version: string;
export const revision: string;
export const env: Record<string, string | undefined>;
export const main: string;
export const argv: string[];

// --- Timing ---

export function sleep(msOrDate: number | Date): Promise<void>;
export function sleepSync(ms: number): void;
export function nanoseconds(): number;

// --- UUID ---

export function randomUUIDv7(format?: "hex" | "base64" | "base64url" | "buffer", timestamp?: number): string | Buffer;

// --- System ---

export function which(name: string, options?: { PATH?: string; cwd?: string }): string | null;

// --- Promise ---

export function peek(promise: Promise<any>): Promise<any>;

// --- Comparison ---

export function deepEquals(a: any, b: any, strict?: boolean): boolean;

// --- Inspection ---

export function inspect(obj: any, options?: { depth?: number; colors?: boolean }): string;
export const inspect: {
  (obj: any, options?: { depth?: number; colors?: boolean }): string;
  custom: symbol;
  table(data: any[], columns?: string[], options?: { colors?: boolean }): string;
};

// --- Strings ---

export function escapeHTML(str: string): string;
export function stringWidth(str: string, options?: { countAnsiEscapeCodes?: boolean }): number;
export function stripANSI(str: string): string;
export function wrapAnsi(str: string, columns: number, options?: { hard?: boolean }): string;

// --- URL conversion ---

export function fileURLToPath(url: URL): string;
export function pathToFileURL(path: string): URL;

// --- Compression ---

export function gzipSync(buf: Buffer | ArrayBuffer | ArrayBufferView): Buffer;
export function gunzipSync(buf: Buffer | ArrayBuffer | ArrayBufferView): Buffer;
export function deflateSync(buf: Buffer | ArrayBuffer | ArrayBufferView): Buffer;
export function inflateSync(buf: Buffer | ArrayBuffer | ArrayBufferView): Buffer;
export function gzip(buf: Buffer | ArrayBuffer | ArrayBufferView): Promise<Buffer>;
export function gunzip(buf: Buffer | ArrayBuffer | ArrayBufferView): Promise<Buffer>;
export function deflate(buf: Buffer | ArrayBuffer | ArrayBufferView): Promise<Buffer>;
export function inflate(buf: Buffer | ArrayBuffer | ArrayBufferView): Promise<Buffer>;

// --- Streams ---

export function readableStreamToArrayBuffer(stream: ReadableStream): Promise<ArrayBuffer>;
export function readableStreamToBytes(stream: ReadableStream): Promise<Uint8Array>;
export function readableStreamToBlob(stream: ReadableStream): Promise<Blob>;
export function readableStreamToJSON(stream: ReadableStream): Promise<any>;
export function readableStreamToText(stream: ReadableStream): Promise<string>;
export function readableStreamToArray(stream: ReadableStream): Promise<any[]>;
export function readableStreamToFormData(stream: ReadableStream, boundary?: string): Promise<FormData>;

// --- Resolution ---

export function resolveSync(specifier: string, from: string): string;

// --- Memory ---

export function gc(options?: { runSweep?: boolean }): void;
export function allocUnsafe(size: number): Buffer;
export function concatArrayBuffers(buffers: (ArrayBuffer | ArrayBufferView)[]): ArrayBuffer;
export function indexOfLine(buf: Buffer | ArrayBufferView, offset?: number): number;

// --- Serve ---

export interface ServeOptions {
  port?: number;
  hostname?: string;
  fetch: (req: Request, server: Server) => Response | Promise<Response>;
  routes?: Record<string, Response | ((req: Request) => Response | Promise<Response>)>;
  error?: (err: Error) => Response;
  idleTimeout?: number;
  development?: boolean;
  unix?: string;
  tls?: { key: string; cert: string };
}

export interface Server {
  readonly port: number;
  readonly hostname: string;
  readonly url: URL;
  readonly development: boolean;
  readonly id: string;
  readonly pendingRequests: number;
  readonly pendingWebSockets: number;
  stop(closeActiveConnections?: boolean): Promise<void>;
  reload(options: Partial<ServeOptions>): void;
  fetch(request: Request): Response | Promise<Response>;
  timeout(request: Request, seconds: number): void;
  requestIP(request: Request): { address: string; family: string; port: number } | null;
  ref(): void;
  unref(): void;
  publish(topic: string, data: string | ArrayBufferView): number;
  subscriberCount(topic: string): number;
}

export function serve(options: ServeOptions): Server;

// --- Bun namespace object ---

export const bun: {
  file: typeof file;
  write: typeof write;
  stdin: typeof stdin;
  stdout: typeof stdout;
  stderr: typeof stderr;
  version: typeof version;
  revision: typeof revision;
  env: typeof env;
  main: typeof main;
  argv: typeof argv;
  sleep: typeof sleep;
  sleepSync: typeof sleepSync;
  nanoseconds: typeof nanoseconds;
  randomUUIDv7: typeof randomUUIDv7;
  which: typeof which;
  peek: typeof peek;
  deepEquals: typeof deepEquals;
  inspect: typeof inspect;
  escapeHTML: typeof escapeHTML;
  stringWidth: typeof stringWidth;
  stripANSI: typeof stripANSI;
  wrapAnsi: typeof wrapAnsi;
  fileURLToPath: typeof fileURLToPath;
  pathToFileURL: typeof pathToFileURL;
  gzipSync: typeof gzipSync;
  gunzipSync: typeof gunzipSync;
  deflateSync: typeof deflateSync;
  inflateSync: typeof inflateSync;
  gzip: typeof gzip;
  gunzip: typeof gunzip;
  deflate: typeof deflate;
  inflate: typeof inflate;
  readableStreamToArrayBuffer: typeof readableStreamToArrayBuffer;
  readableStreamToBytes: typeof readableStreamToBytes;
  readableStreamToBlob: typeof readableStreamToBlob;
  readableStreamToJSON: typeof readableStreamToJSON;
  readableStreamToText: typeof readableStreamToText;
  readableStreamToArray: typeof readableStreamToArray;
  readableStreamToFormData: typeof readableStreamToFormData;
  resolveSync: typeof resolveSync;
  gc: typeof gc;
  allocUnsafe: typeof allocUnsafe;
  concatArrayBuffers: typeof concatArrayBuffers;
  indexOfLine: typeof indexOfLine;
};

export default bun;
