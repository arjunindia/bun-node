import childProcess from "node:child_process";
import { spawn as nodeSpawn, spawnSync as nodeSpawnSync } from "node:child_process";
import { Readable, PassThrough } from "node:stream";

// --- Subprocess class ---

class Subprocess {
  #proc;
  #stdin;
  #stdout;
  #stderr;
  #exited;
  #exitCode;
  #signalCode;
  #killed;
  #onExit;
  #ipcHandlers;
  #ipcBuffer;

  constructor(cmd, options = {}) {
    this.#killed = false;
    this.#exitCode = null;
    this.#signalCode = null;
    this.#onExit = options.onExit || null;
    this.#ipcHandlers = [];
    this.#ipcBuffer = [];

    const args = Array.isArray(cmd) ? cmd : (cmd.cmd || cmd);
    const command = args[0];
    const commandArgs = args.slice(1);

    const nodeOpts = {
      cwd: options.cwd || undefined,
      env: options.env || process.env,
      stdio: this.#mapStdio(options),
      detached: options.detached ?? false,
    };

    this.#proc = nodeSpawn(command, commandArgs, nodeOpts);

    // Setup stdin
    if (options.stdin === "pipe" || options.stdin === null || options.stdin === undefined) {
      this.#stdin = this.#proc.stdin;
    } else if (options.stdin === "inherit") {
      this.#stdin = null;
    } else {
      // For Response, Blob, etc. — write to stdin
      this.#stdin = this.#proc.stdin;
      this.#writeStdin(options.stdin);
    }

    // Setup stdout/stderr as ReadableStreams
    if (options.stdout === "pipe" || options.stdout === undefined) {
      this.#stdout = this.#proc.stdout ? this.#proc.stdout : null;
    } else if (options.stdout === "ignore") {
      this.#stdout = null;
    } else if (options.stdout === "inherit") {
      this.#stdout = null;
    } else {
      this.#stdout = this.#proc.stdout;
    }

    if (options.stderr === "pipe") {
      this.#stderr = this.#proc.stderr;
    } else if (options.stderr === "ignore") {
      this.#stderr = null;
    } else if (options.stderr === "inherit" || options.stderr === undefined) {
      this.#stderr = null;
    } else {
      this.#stderr = this.#proc.stderr;
    }

    // Setup IPC
    if (options.ipc) {
      this.#proc.on("message", (msg) => {
        options.ipc(msg, this);
      });
    }

    // Exited promise
    this.#exited = new Promise((resolve, reject) => {
      this.#proc.on("close", (code, signal) => {
        this.#exitCode = code;
        this.#signalCode = signal;
        this.#killed = this.#proc.killed;
        if (this.#onExit) {
          this.#onExit(this, code, signal, null);
        }
        resolve(code);
      });

      this.#proc.on("error", (err) => {
        if (this.#onExit) {
          this.#onExit(this, null, null, err);
        }
        reject(err);
      });
    });

    // Handle timeout
    if (options.timeout) {
      setTimeout(() => {
        const signal = options.killSignal || "SIGTERM";
        this.kill(signal);
      }, options.timeout);
    }
  }

  #mapStdio(options) {
    const mapOne = (val, defaultVal) => {
      if (val === "pipe" || val === undefined) return "pipe";
      if (val === "inherit") return "inherit";
      if (val === "ignore") return "ignore";
      if (typeof val === "number") return val;
      return defaultVal;
    };

    return [
      mapOne(options.stdin, "pipe"),
      mapOne(options.stdout, "pipe"),
      mapOne(options.stderr, "inherit"),
    ];
  }

  async #writeStdin(input) {
    if (!this.#proc.stdin) return;

    try {
      if (typeof input === "string") {
        this.#proc.stdin.write(input);
        this.#proc.stdin.end();
      } else if (input instanceof Response) {
        const body = await input.arrayBuffer();
        this.#proc.stdin.write(Buffer.from(body));
        this.#proc.stdin.end();
      } else if (input instanceof Blob) {
        const buf = Buffer.from(await input.arrayBuffer());
        this.#proc.stdin.write(buf);
        this.#proc.stdin.end();
      } else if (Buffer.isBuffer(input) || ArrayBuffer.isView(input)) {
        this.#proc.stdin.write(input);
        this.#proc.stdin.end();
      } else if (input instanceof ReadableStream) {
        const reader = input.getReader();
        const pump = async () => {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            this.#proc.stdin.write(value);
          }
          this.#proc.stdin.end();
        };
        pump();
      } else if (input instanceof Readable) {
        input.pipe(this.#proc.stdin);
      }
    } catch {
      // stdin write failed
    }
  }

  get stdin() {
    return this.#stdin;
  }

  get stdout() {
    return this.#stdout;
  }

  get stderr() {
    return this.#stderr;
  }

  get pid() {
    return this.#proc.pid;
  }

  get exited() {
    return this.#exited;
  }

  get exitCode() {
    return this.#exitCode;
  }

  get signalCode() {
    return this.#signalCode;
  }

  get killed() {
    return this.#killed;
  }

  kill(signal) {
    this.#killed = true;
    if (typeof signal === "number") {
      // Convert number to signal name
      this.#proc.kill(`SIG${signal}`);
    } else {
      this.#proc.kill(signal || "SIGTERM");
    }
  }

  ref() {
    this.#proc.ref();
  }

  unref() {
    this.#proc.unref();
  }

  send(message) {
    if (this.#proc.send) {
      this.#proc.send(message);
    } else {
      throw new Error("IPC not available — process not spawned with ipc option");
    }
  }

  disconnect() {
    if (this.#proc.disconnect) {
      this.#proc.disconnect();
    }
  }

  resourceUsage() {
    // Node.js doesn't expose resource usage for child processes directly
    // Return a stub
    return {
      maxRSS: 0,
      cpuTime: { user: 0, system: 0 },
    };
  }
}

// --- SyncSubprocess class ---

class SyncSubprocess {
  #result;

  constructor(cmd, options = {}) {
    const args = Array.isArray(cmd) ? cmd : (cmd.cmd || cmd);
    const command = args[0];
    const commandArgs = args.slice(1);

    const nodeOpts = {
      cwd: options.cwd || undefined,
      env: options.env || process.env,
      encoding: options.encoding || "buffer",
      maxBuffer: options.maxBuffer || 1024 * 1024 * 10, // 10MB default
      timeout: options.timeout || undefined,
      killSignal: options.killSignal || "SIGTERM",
    };

    this.#result = nodeSpawnSync(command, commandArgs, nodeOpts);
  }

  get stdout() {
    return this.#result.stdout;
  }

  get stderr() {
    return this.#result.stderr;
  }

  get exitCode() {
    return this.#result.status;
  }

  get success() {
    return this.#result.status === 0;
  }

  get signalCode() {
    return this.#result.signal || undefined;
  }

  get pid() {
    return this.#result.pid;
  }

  get resourceUsage() {
    return {
      maxRSS: 0,
      cpuTime: { user: 0, system: 0 },
    };
  }

  get exitedDueToTimeout() {
    return this.#result.error?.code === "ETIMEDOUT" || undefined;
  }
}

// --- Public API ---

function spawn(cmdOrOptions, options) {
  let cmd, opts;
  if (Array.isArray(cmdOrOptions)) {
    cmd = cmdOrOptions;
    opts = options || {};
  } else {
    cmd = cmdOrOptions.cmd;
    opts = cmdOrOptions;
  }
  return new Subprocess(cmd, opts);
}

function spawnSync(cmdOrOptions, options) {
  let cmd, opts;
  if (Array.isArray(cmdOrOptions)) {
    cmd = cmdOrOptions;
    opts = options || {};
  } else {
    cmd = cmdOrOptions.cmd;
    opts = cmdOrOptions;
  }
  return new SyncSubprocess(cmd, opts);
}

export { spawn, spawnSync, Subprocess, SyncSubprocess };
export default { spawn, spawnSync, Subprocess, SyncSubprocess };
