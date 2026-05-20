import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import zlib from "node:zlib";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import childProcess from "node:child_process";

// --- Helpers ---

const DEFAULT_MIME = "text/plain;charset=utf-8";

function detectMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    ".txt": "text/plain;charset=utf-8",
    ".html": "text/html;charset=utf-8",
    ".htm": "text/html;charset=utf-8",
    ".css": "text/css;charset=utf-8",
    ".js": "text/javascript;charset=utf-8",
    ".mjs": "text/javascript;charset=utf-8",
    ".ts": "text/typescript;charset=utf-8",
    ".mts": "text/typescript;charset=utf-8",
    ".tsx": "text/typescript-jsx;charset=utf-8",
    ".jsx": "text/javascript-jsx;charset=utf-8",
    ".json": "application/json;charset=utf-8",
    ".json5": "application/json5;charset=utf-8",
    ".jsonc": "application/jsonc;charset=utf-8",
    ".jsonl": "application/jsonl;charset=utf-8",
    ".xml": "application/xml;charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".heic": "image/heic",
    ".ico": "image/x-icon",
    ".bmp": "image/bmp",
    ".tiff": "image/tiff",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".pdf": "application/pdf",
    ".zip": "application/zip",
    ".gz": "application/gzip",
    ".tar": "application/x-tar",
    ".wasm": "application/wasm",
    ".toml": "application/toml",
    ".yaml": "application/yaml",
    ".yml": "application/yaml",
    ".md": "text/markdown;charset=utf-8",
    ".csv": "text/csv;charset=utf-8",
    ".sql": "application/sql",
    ".sh": "application/x-sh",
    ".bat": "application/x-bat",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
  };
  return map[ext] || DEFAULT_MIME;
}

function resolvePath(p) {
  if (typeof p === "string") {
    return path.resolve(p);
  }
  if (p instanceof URL) {
    return fileURLToPath(p);
  }
  if (p instanceof BunFile) {
    return p._filePath;
  }
  throw new TypeError(`Expected string, number, BunFile, or URL, got ${typeof p}`);
}

// --- FileSink ---

class FileSink {
  #fd;
  #path;
  #highWaterMark;
  #buffer;
  #bufferPos;
  #closed;

  constructor(filePath, options = {}) {
    this.#path = filePath;
    this.#highWaterMark = options.highWaterMark ?? 16384;
    this.#buffer = Buffer.alloc(this.#highWaterMark);
    this.#bufferPos = 0;
    this.#closed = false;

    // Create file if it doesn't exist, truncate if it does
    this.#fd = fs.openSync(filePath, "w");
  }

  write(chunk) {
    if (this.#closed) throw new Error("FileSink is closed");

    let data;
    if (typeof chunk === "string") {
      data = Buffer.from(chunk);
    } else if (chunk instanceof ArrayBuffer || chunk instanceof SharedArrayBuffer) {
      data = Buffer.from(chunk);
    } else if (ArrayBuffer.isView(chunk)) {
      data = Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    } else {
      data = Buffer.from(String(chunk));
    }

    let written = 0;
    while (written < data.length) {
      const remaining = this.#highWaterMark - this.#bufferPos;
      const toCopy = Math.min(remaining, data.length - written);
      data.copy(this.#buffer, this.#bufferPos, written, written + toCopy);
      this.#bufferPos += toCopy;
      written += toCopy;

      if (this.#bufferPos >= this.#highWaterMark) {
        this.#flushSync();
      }
    }
    return written;
  }

  #flushSync() {
    if (this.#bufferPos > 0) {
      fs.writeSync(this.#fd, this.#buffer, 0, this.#bufferPos);
      this.#bufferPos = 0;
    }
  }

  flush() {
    if (this.#closed) return 0;
    this.#flushSync();
    return this.#bufferPos;
  }

  end() {
    if (this.#closed) return 0;
    this.#flushSync();
    fs.closeSync(this.#fd);
    this.#closed = true;
    return 0;
  }

  ref() {
    // Node.js doesn't track refs on fd the same way Bun does, no-op
  }

  unref() {
    // Node.js doesn't track refs on fd the same way Bun does, no-op
  }
}

// --- BunFile ---

class BunFile extends Blob {
  _filePath;
  _mimeType;

  constructor(filePath, options = {}) {
    const mime = options.type ?? detectMime(filePath);
    // Bun appends charset=utf-8 to text-based types if not already present
    const needsCharset = !mime.includes("charset") && (
      mime.startsWith("text/") ||
      mime.startsWith("application/json") ||
      mime.startsWith("application/xml") ||
      mime.startsWith("application/javascript") ||
      mime.startsWith("application/typescript") ||
      mime.startsWith("application/toml") ||
      mime.startsWith("application/yaml") ||
      mime.startsWith("application/sql") ||
      mime.startsWith("application/x-sh")
    );
    const finalMime = needsCharset ? mime + ";charset=utf-8" : mime;
    super([], { type: finalMime });
    this._filePath = filePath;
    this._mimeType = finalMime;
  }

  get size() {
    try {
      const stat = fs.statSync(this._filePath);
      return stat.size;
    } catch {
      return 0;
    }
  }

  get type() {
    return this._mimeType;
  }

  async exists() {
    try {
      await fsPromises.access(this._filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async text() {
    return fsPromises.readFile(this._filePath, "utf-8");
  }

  async json() {
    const content = await this.text();
    return JSON.parse(content);
  }

  async arrayBuffer() {
    const buf = await fsPromises.readFile(this._filePath);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }

  async bytes() {
    const buf = await fsPromises.readFile(this._filePath);
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  stream() {
    return fs.createReadStream(this._filePath);
  }

  writer(options) {
    return new FileSink(this._filePath, options);
  }

  async delete() {
    try {
      await fsPromises.unlink(this._filePath);
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
  }
}

// --- Stdin/Stdout/Stderr BunFile wrappers ---

class StdinBunFile extends BunFile {
  constructor() {
    super("/dev/null");
  }

  get size() {
    return 0;
  }

  async text() {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString("utf-8");
  }

  async arrayBuffer() {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    const buf = Buffer.concat(chunks);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }

  async bytes() {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    const buf = Buffer.concat(chunks);
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  stream() {
    return process.stdin;
  }
}

class StdoutBunFile extends BunFile {
  constructor() {
    super("/dev/null");
  }

  get size() {
    return 0;
  }

  writer() {
    return {
      write(chunk) {
        const data = typeof chunk === "string" ? chunk : Buffer.from(chunk);
        process.stdout.write(data);
        return typeof data === "string" ? Buffer.byteLength(data) : data.length;
      },
      flush() {
        return 0;
      },
      end() {
        return 0;
      },
      ref() {},
      unref() {},
    };
  }
}

class StderrBunFile extends BunFile {
  constructor() {
    super("/dev/null");
  }

  get size() {
    return 0;
  }

  writer() {
    return {
      write(chunk) {
        const data = typeof chunk === "string" ? chunk : Buffer.from(chunk);
        process.stderr.write(data);
        return typeof data === "string" ? Buffer.byteLength(data) : data.length;
      },
      flush() {
        return 0;
      },
      end() {
        return 0;
      },
      ref() {},
      unref() {},
    };
  }
}

// --- Bun.file() ---

function file(pathOrFd, options) {
  if (typeof pathOrFd === "number") {
    // File descriptor - wrap in BunFile
    return new BunFile(`/dev/fd/${pathOrFd}`, options);
  }
  return new BunFile(resolvePath(pathOrFd), options);
}

// --- Bun.write() ---

async function write(destination, input) {
  let destPath;
  if (typeof destination === "number") {
    destPath = `/dev/fd/${destination}`;
  } else if (destination instanceof BunFile) {
    destPath = destination._filePath;
  } else {
    destPath = resolvePath(destination);
  }

  // Ensure parent directory exists
  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) {
    await fsPromises.mkdir(dir, { recursive: true });
  }

  if (typeof input === "string") {
    await fsPromises.writeFile(destPath, input, "utf-8");
    return Buffer.byteLength(input);
  }

  if (input instanceof BunFile) {
    // Copy file
    const srcContent = await fsPromises.readFile(input._filePath);
    await fsPromises.writeFile(destPath, srcContent);
    return srcContent.length;
  }

  if (input instanceof Blob) {
    const buf = Buffer.from(await input.arrayBuffer());
    await fsPromises.writeFile(destPath, buf);
    return buf.length;
  }

  if (input instanceof Response) {
    const body = await input.arrayBuffer();
    const buf = Buffer.from(body);
    await fsPromises.writeFile(destPath, buf);
    return buf.length;
  }

  if (input instanceof ArrayBuffer || input instanceof SharedArrayBuffer) {
    const buf = Buffer.from(input);
    await fsPromises.writeFile(destPath, buf);
    return buf.length;
  }

  if (ArrayBuffer.isView(input)) {
    const buf = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
    await fsPromises.writeFile(destPath, buf);
    return buf.length;
  }

  throw new TypeError(`Unsupported input type: ${typeof input}`);
}

// --- Bun.version / Bun.revision / Bun.env / Bun.main / Bun.argv ---

const version = "0.0.0"; // buniso version
const revision = "buniso-compat";
const env = process.env;
const main = process.argv[1] ? path.resolve(process.argv[1]) : "";
const argv = [...process.argv];

// --- Bun.sleep / Bun.sleepSync / Bun.nanoseconds ---

function sleep(msOrDate) {
  const ms = msOrDate instanceof Date
    ? Math.max(0, msOrDate.getTime() - Date.now())
    : Number(msOrDate);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sleepSync(ms) {
  const start = performance.now();
  while (performance.now() - start < ms) {
    // busy wait
  }
}

const processStartHrtime = process.hrtime.bigint();

function nanoseconds() {
  return Number(process.hrtime.bigint() - processStartHrtime);
}

// --- Bun.randomUUIDv7 ---

let uuidCounter = 0;

function randomUUIDv7(format = "hex", timestamp) {
  const now = timestamp ?? Date.now();
  const ts = BigInt(now);

  // 48-bit timestamp in milliseconds
  const timeBytes = Buffer.alloc(8);
  timeBytes.writeBigUInt64BE(ts, 0);
  // Shift to get 48 bits (6 bytes)
  const tsPart = timeBytes.subarray(2, 8);

  // 10 bits of sequence counter for monotonicity
  uuidCounter = (uuidCounter + 1) & 0x3ff;

  // 12 bits random + 2 bits version (0110) + 10 bits counter + 2 bits variant (10) + 48 bits random
  const rand1 = crypto.getRandomValues(new Uint8Array(2));
  const rand2 = crypto.getRandomValues(new Uint8Array(8));

  // Version 7: bits 48-51 = 0111
  const byte6 = 0x70 | (rand1[0] >> 4);
  const byte7 = ((rand1[0] & 0x0f) << 4) | (rand1[1] >> 4);

  // Variant 10: bits 64-65 = 10
  const byte8 = 0x80 | (uuidCounter >> 2);
  const byte9 = ((uuidCounter & 0x03) << 6) | (rand2[0] & 0x3f);

  const bytes = Buffer.concat([
    tsPart,
    Buffer.from([byte6, byte7, byte8, byte9]),
    rand2.subarray(0, 6),
  ]);

  if (format === "buffer") {
    return bytes;
  }

  const hex = bytes.toString("hex");
  const formatted = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;

  if (format === "hex") return formatted;
  if (format === "base64") return Buffer.from(formatted).toString("base64");
  if (format === "base64url") return Buffer.from(formatted).toString("base64url");

  return formatted;
}

// --- Bun.which ---

function which(name, options = {}) {
  const envPATH = options.PATH ?? process.env.PATH ?? "";
  const sep = process.platform === "win32" ? ";" : ":";
  const dirs = envPATH.split(sep);

  for (const dir of dirs) {
    const candidate = path.join(dir, name);
    // Check with common extensions on Windows
    if (process.platform === "win32") {
      const exts = [".exe", ".cmd", ".bat", ".com", ""];
      for (const ext of exts) {
        const full = candidate + ext;
        try {
          fs.accessSync(full, fs.constants.X_OK);
          return full;
        } catch {}
      }
    } else {
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return candidate;
      } catch {}
    }
  }
  return null;
}

// --- Bun.peek ---

function peek(promise) {
  // Returns the settled value, or the promise itself if pending
  let result;
  let settled = false;
  let value;
  let reason;

  promise.then(
    (v) => { settled = true; value = v; },
    (e) => { settled = true; reason = e; },
  );

  // Use a microtask to check - this is a synchronous peek
  // In Bun, peek returns the value if settled, otherwise the promise
  // We can't truly synchronously inspect a promise in Node.js
  // so we return a proxy that reflects on the next microtask
  return promise;
}

peek.status = function status(promise) {
  // Node.js can't synchronously inspect promise state
  // Return "pending" as default - this is a limitation
  return "pending";
};

// --- Bun.deepEquals ---

function deepEquals(a, b, strict = false) {
  if (Object.is(a, b)) return true;

  if (a === null || b === null || a === undefined || b === undefined) {
    return strict ? false : a == b;
  }

  if (typeof a !== typeof b) return false;

  if (typeof a !== "object") return Object.is(a, b);

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (a instanceof RegExp && b instanceof RegExp) {
    return a.toString() === b.toString();
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) {
    if (!strict) {
      // In non-strict mode, check if all keys in b exist in a
      for (const key of keysB) {
        if (!keysA.includes(key) && b[key] !== undefined) return false;
      }
    } else {
      return false;
    }
  }

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) {
      if (strict) return false;
      if (a[key] !== undefined) return false;
      continue;
    }
    if (!deepEquals(a[key], b[key], strict)) return false;
  }

  return true;
}

// --- Bun.inspect ---

const customInspectSymbol = Symbol.for("bun.inspect.custom");

function inspect(obj, options = {}) {
  if (obj !== null && typeof obj === "object" && obj[customInspectSymbol]) {
    return obj[customInspectSymbol]();
  }
  // Use Node's util.inspect as base
  const util = createRequire(import.meta.url)("node:util");
  return util.inspect(obj, {
    depth: options.depth ?? 2,
    colors: options.colors ?? false,
    showHidden: options.showHidden ?? false,
    compact: options.compact ?? true,
  });
}

inspect.custom = customInspectSymbol;

inspect.table = function table(data, columns, options = {}) {
  const util = createRequire(import.meta.url)("node:util");
  if (Array.isArray(data)) {
    const cols = columns ?? Object.keys(data[0] ?? {});
    const header = cols.join("\t");
    const rows = data.map((row) =>
      cols.map((col) => {
        const val = row[col];
        return typeof val === "object" ? util.inspect(val) : String(val);
      }).join("\t")
    );
    return [header, ...rows].join("\n");
  }
  // If data is an object, show key-value pairs
  const entries = Object.entries(data);
  const header = "(index)\tvalue";
  const rows = entries.map(([k, v]) => `${k}\t${typeof v === "object" ? util.inspect(v) : v}`);
  return [header, ...rows].join("\n");
};

// --- Bun.escapeHTML ---

const htmlEscapeMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
  "`": "&#96;",
};

function escapeHTML(str) {
  return String(str).replace(/[&<>"'`/]/g, (ch) => htmlEscapeMap[ch]);
}

// --- Bun.stringWidth / Bun.stripANSI / Bun.wrapAnsi ---

function stripANSI(str) {
  // eslint-disable-next-line no-control-regex
  return String(str).replace(/\x1b\[[0-9;]*m/g, "");
}

function stringWidth(str, options = {}) {
  const s = String(str);
  const clean = options.countAnsiEscapeCodes ? s : stripANSI(s);

  let width = 0;
  for (const char of clean) {
    const code = char.codePointAt(0);
    // CJK and fullwidth characters count as 2
    if (
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0x303e) ||
      (code >= 0x3040 && code <= 0x33bf) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x4e00 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe30 && code <= 0xfe6f) ||
      (code >= 0xff01 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6) ||
      (code >= 0x20000 && code <= 0x2fffd) ||
      (code >= 0x30000 && code <= 0x3fffd)
    ) {
      width += 2;
    } else if (code >= 0x20 && code <= 0x7e) {
      width += 1;
    }
    // Control characters, combining marks, etc. = 0
  }
  return width;
}

function wrapAnsi(input, columns, options = {}) {
  const str = String(input);
  const lines = str.split("\n");
  const result = [];

  for (const line of lines) {
    if (stringWidth(line) <= columns) {
      result.push(line);
      continue;
    }

    let currentLine = "";
    let currentWidth = 0;
    let i = 0;

    while (i < line.length) {
      // Check for ANSI escape sequence
      const ansiMatch = line.slice(i).match(/^\x1b\[[0-9;]*m/);
      if (ansiMatch) {
        currentLine += ansiMatch[0];
        i += ansiMatch[0].length;
        continue;
      }

      const char = line[i];
      const charCode = char.codePointAt(0);
      const charWidth = (
        (charCode >= 0x1100 && charCode <= 0x115f) ||
        (charCode >= 0x2e80 && charCode <= 0x303e) ||
        (charCode >= 0x3040 && charCode <= 0x33bf) ||
        (charCode >= 0x3400 && charCode <= 0x4dbf) ||
        (charCode >= 0x4e00 && charCode <= 0xa4cf) ||
        (charCode >= 0xac00 && charCode <= 0xd7a3) ||
        (charCode >= 0xff01 && charCode <= 0xff60) ||
        (charCode >= 0xffe0 && charCode <= 0xffe6)
      ) ? 2 : 1;

      if (currentWidth + charWidth > columns && currentLine.length > 0) {
        result.push(currentLine);
        currentLine = "";
        currentWidth = 0;
      }

      currentLine += char;
      currentWidth += charWidth;
      i += char.length > 1 ? 2 : 1; // handle surrogate pairs
    }

    if (currentLine.length > 0) {
      result.push(currentLine);
    }
  }

  return result.join("\n");
}

// --- Bun.gzipSync / Bun.gunzipSync / Bun.deflateSync / Bun.inflateSync ---

function gzipSync(buf, options = {}) {
  const input = toBuffer(buf);
  return zlib.gzipSync(input, { level: options.level });
}

function gunzipSync(buf) {
  return zlib.gunzipSync(toBuffer(buf));
}

function deflateSync(buf, options = {}) {
  const input = toBuffer(buf);
  return zlib.deflateSync(input, { level: options.level });
}

function inflateSync(buf) {
  return zlib.inflateSync(toBuffer(buf));
}

const gzipAsync = promisify(zlib.gzip);
const gunzipAsync = promisify(zlib.gunzip);
const deflateAsync = promisify(zlib.deflate);
const inflateAsync = promisify(zlib.inflate);

async function gzip(buf, options = {}) {
  return gzipAsync(toBuffer(buf), { level: options.level });
}

async function gunzip(buf) {
  return gunzipAsync(toBuffer(buf));
}

async function deflate(buf, options = {}) {
  return deflateAsync(toBuffer(buf), { level: options.level });
}

async function inflate(buf) {
  return inflateAsync(toBuffer(buf));
}

function toBuffer(buf) {
  if (Buffer.isBuffer(buf)) return buf;
  if (buf instanceof ArrayBuffer) return Buffer.from(buf);
  if (buf instanceof SharedArrayBuffer) return Buffer.from(buf);
  if (ArrayBuffer.isView(buf)) return Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
  return Buffer.from(buf);
}

// --- Bun.readableStreamTo* ---

async function readableStreamToArrayBuffer(stream) {
  const reader = stream.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(Buffer.isBuffer(value) ? value : Buffer.from(value));
  }
  const buf = Buffer.concat(chunks);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

async function readableStreamToBytes(stream) {
  const reader = stream.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(Buffer.isBuffer(value) ? value : Buffer.from(value));
  }
  const buf = Buffer.concat(chunks);
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

async function readableStreamToBlob(stream) {
  const reader = stream.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return new Blob(chunks);
}

async function readableStreamToJSON(stream) {
  const text = await readableStreamToText(stream);
  return JSON.parse(text);
}

async function readableStreamToText(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (typeof value === "string") {
      result += value;
    } else {
      result += decoder.decode(value, { stream: true });
    }
  }
  result += decoder.decode();
  return result;
}

async function readableStreamToArray(stream) {
  const reader = stream.getReader();
  const result = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result.push(value);
  }
  return result;
}

async function readableStreamToFormData(stream, boundary) {
  const text = await readableStreamToText(stream);
  // Basic multipart form data parsing
  if (!boundary) {
    throw new Error("Boundary is required for multipart form data");
  }
  const parts = text.split(`--${boundary}`);
  const formData = new FormData();
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed === "--" || trimmed === "") continue;
    const headerEnd = trimmed.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;
    const headers = trimmed.slice(0, headerEnd);
    const body = trimmed.slice(headerEnd + 4);
    const nameMatch = headers.match(/name="([^"]+)"/);
    if (nameMatch) {
      formData.append(nameMatch[1], body);
    }
  }
  return formData;
}

// --- Bun.resolveSync ---

function resolveSync(specifier, from) {
  const require = createRequire(from.startsWith("file://") ? from : pathToFileURL(from).href);
  return require.resolve(specifier);
}

// --- Bun.gc / Bun.allocUnsafe / Bun.concatArrayBuffers / Bun.indexOfLine ---

function gc(options = {}) {
  if (globalThis.gc) {
    globalThis.gc();
  }
  if (options.runSweep && globalThis.gc) {
    globalThis.gc();
  }
}

function allocUnsafe(size) {
  return Buffer.allocUnsafe(size);
}

function concatArrayBuffers(buffers) {
  const bufs = buffers.map((b) => {
    if (b instanceof ArrayBuffer) return Buffer.from(b);
    if (b instanceof SharedArrayBuffer) return Buffer.from(b);
    if (ArrayBuffer.isView(b)) return Buffer.from(b.buffer, b.byteOffset, b.byteLength);
    return Buffer.from(b);
  });
  const result = Buffer.concat(bufs);
  return result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength);
}

function indexOfLine(buf, offset = 0) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  for (let i = offset; i < b.length; i++) {
    if (b[i] === 0x0a) return i; // \n
  }
  return -1;
}

// --- SQL ---

export { SQL, SQLError, PostgresError, SQLiteError } from "./sql.js";

// --- Singleton instances ---

const stdin = new StdinBunFile();
const stdout = new StdoutBunFile();
const stderr = new StderrBunFile();

// --- Named exports ---

// File I/O
export { file, write, stdin, stdout, stderr, BunFile, FileSink };

// Properties
export { version, revision, env, main, argv };

// Timing
export { sleep, sleepSync, nanoseconds };

// UUID
export { randomUUIDv7 };

// System
export { which };

// Promise
export { peek };

// Comparison
export { deepEquals };

// Inspection
export { inspect };

// Strings
export { escapeHTML, stringWidth, stripANSI, wrapAnsi };

// URL conversion
export { fileURLToPath, pathToFileURL };

// Compression
export { gzipSync, gunzipSync, deflateSync, inflateSync, gzip, gunzip, deflate, inflate };

// Streams
export { readableStreamToArrayBuffer, readableStreamToBytes, readableStreamToBlob, readableStreamToJSON, readableStreamToText, readableStreamToArray, readableStreamToFormData };

// Resolution
export { resolveSync };

// Memory
export { gc, allocUnsafe, concatArrayBuffers, indexOfLine };

// Namespace object (Bun.file, Bun.sleep, etc.)
export const bun = {
  file, write, stdin, stdout, stderr, BunFile, FileSink,
  version, revision, env, main, argv,
  sleep, sleepSync, nanoseconds,
  randomUUIDv7, which, peek, deepEquals, inspect,
  escapeHTML, stringWidth, stripANSI, wrapAnsi,
  fileURLToPath, pathToFileURL,
  gzipSync, gunzipSync, deflateSync, inflateSync, gzip, gunzip, deflate, inflate,
  readableStreamToArrayBuffer, readableStreamToBytes, readableStreamToBlob,
  readableStreamToJSON, readableStreamToText, readableStreamToArray, readableStreamToFormData,
  resolveSync, gc, allocUnsafe, concatArrayBuffers, indexOfLine,
};

export default bun;
