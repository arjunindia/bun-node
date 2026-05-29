// Bun Worker shim — wraps Node's worker_threads behind Bun's Worker API
import worker_threads from "node:worker_threads";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isMainThread as nodeIsMainThread } from "node:worker_threads";

// --- Worker class ---

class Worker extends EventTarget {
  #worker;
  #ready;
  #closed;

  constructor(pathOrUrl, options = {}) {
    super();

    this.#closed = false;

    // Resolve path
    let resolvedPath;
    if (typeof pathOrUrl === "string") {
      if (pathOrUrl.startsWith("blob:")) {
        // Blob URL — extract the code from the URL
        // For simplicity, treat blob URLs as inline code
        resolvedPath = pathOrUrl;
      } else {
        resolvedPath = path.resolve(pathOrUrl);
      }
    } else if (pathOrUrl instanceof URL) {
      resolvedPath = pathOrUrl.href;
    } else {
      resolvedPath = String(pathOrUrl);
    }

    // Build worker_threads options
    const workerOpts = {
      workerData: options.preload ? { preload: options.preload } : undefined,
    };

    // If blob URL, create worker from inline code
    if (typeof pathOrUrl === "string" && pathOrUrl.startsWith("blob:")) {
      // Blob URLs aren't directly supported by worker_threads
      // We'd need to resolve the blob — for now, throw
      throw new Error("blob: URLs are not supported in this shim. Use a file path instead.");
    }

    this.#worker = new worker_threads.Worker(resolvedPath, workerOpts);

    // Emit "open" event when worker is online
    this.#ready = new Promise((resolve) => {
      this.#worker.on("online", () => {
        this.dispatchEvent(new Event("open"));
        resolve();
      });
    });

    // Forward messages from worker
    this.#worker.on("message", (data) => {
      const event = new MessageEvent("message", { data });
      this.dispatchEvent(event);
      if (this.onmessage) this.onmessage(event);
    });

    // Forward errors
    this.#worker.on("error", (err) => {
      const event = new ErrorEvent("error", { error: err, message: err.message });
      this.dispatchEvent(event);
      if (this.onerror) this.onerror(event);
    });

    // Emit "close" event when worker exits
    this.#worker.on("exit", (code) => {
      this.#closed = true;
      const event = new CloseEvent("close", { code });
      this.dispatchEvent(event);
      if (this.onclose) this.onclose(event);
    });
  }

  postMessage(data, transferOrOptions) {
    if (this.#closed) throw new Error("Worker has been terminated");
    this.#worker.postMessage(data, transferOrOptions);
  }

  terminate() {
    if (this.#closed) return;
    this.#worker.terminate();
    this.#closed = true;
  }

  ref() {
    this.#worker.ref();
  }

  unref() {
    this.#worker.unref();
  }

  get threadId() {
    return this.#worker.threadId;
  }

  get onmessage() {
    return this._onmessage || null;
  }

  set onmessage(fn) {
    this._onmessage = fn;
  }

  get onerror() {
    return this._onerror || null;
  }

  set onerror(fn) {
    this._onerror = fn;
  }

  get onclose() {
    return this._onclose || null;
  }

  set onclose(fn) {
    this._onclose = fn;
  }
}

// --- CloseEvent polyfill ---

class CloseEvent extends Event {
  constructor(type, init = {}) {
    super(type);
    this.code = init.code ?? 0;
  }
}

// --- ErrorEvent polyfill ---

class ErrorEvent extends Event {
  constructor(type, init = {}) {
    super(type);
    this.error = init.error ?? null;
    this.message = init.message ?? "";
  }
}

// --- isMainThread ---

const isMainThread = nodeIsMainThread;

// --- setEnvironmentData / getEnvironmentData ---

function setEnvironmentData(key, value) {
  worker_threads.setEnvironmentData(key, value);
}

function getEnvironmentData(key) {
  return worker_threads.getEnvironmentData(key);
}

// --- Expose on globalThis if running in main thread ---

if (isMainThread && typeof globalThis.Worker === "undefined") {
  globalThis.Worker = Worker;
}

// --- Exports ---

export {
  Worker,
  isMainThread,
  setEnvironmentData,
  getEnvironmentData,
};

export default {
  Worker,
  isMainThread,
  setEnvironmentData,
  getEnvironmentData,
};
