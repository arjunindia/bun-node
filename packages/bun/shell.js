// Bun Shell ($) — tagged template shell commands using child_process
// Uses execFile("sh", ["-c", cmd]) to avoid Node's built-in shell interpolation.
// Pipes, redirection, and command substitution work because sh handles them natively.
import childProcess from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(childProcess.execFile);

// --- Global config ---

const globalConfig = {
  throwOnError: true,
  env: undefined,   // undefined = use process.env
  cwd: undefined,   // undefined = use process.cwd()
};

// --- ShellError ---

class ShellError extends Error {
  constructor(message, exitCode, stdout, stderr) {
    super(message);
    this.name = "ShellError";
    this.exitCode = exitCode;
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

// --- ShellResult ---

class ShellResult {
  #rawPromise;
  #quiet;
  #throwOnError;
  #perEnv;
  #perCwd;

  constructor(promise, { quiet = false, throwOnError = true, env, cwd } = {}) {
    this.#rawPromise = promise;
    this.#quiet = quiet;
    this.#throwOnError = throwOnError;
    this.#perEnv = env;
    this.#perCwd = cwd;
  }

  #getPromise() {
    if (this.#throwOnError) {
      return this.#rawPromise.then((result) => {
        if (result.exitCode !== 0) {
          throw new ShellError(
            `Command failed with exit code ${result.exitCode}: ${result.stderr}`,
            result.exitCode,
            result.stdout,
            result.stderr
          );
        }
        return result;
      });
    }
    return this.#rawPromise;
  }

  then(onFulfilled, onRejected) {
    return this.#getPromise().then(onFulfilled, onRejected);
  }

  catch(onRejected) {
    return this.#getPromise().catch(onRejected);
  }

  finally(onFinally) {
    return this.#getPromise().finally(onFinally);
  }

  async text() {
    const result = await this.#rawPromise;
    return result.stdout;
  }

  async json() {
    const text = await this.text();
    return JSON.parse(text);
  }

  async arrayBuffer() {
    const result = await this.#rawPromise;
    const buf = Buffer.from(result.stdout);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }

  async blob() {
    const result = await this.#rawPromise;
    return new Blob([Buffer.from(result.stdout)]);
  }

  async bytes() {
    const result = await this.#rawPromise;
    return new Uint8Array(Buffer.from(result.stdout));
  }

  async *lines() {
    const text = await this.text();
    const lines = text.split("\n");
    for (const line of lines) {
      yield line;
    }
  }

  quiet() {
    return new ShellResult(this.#rawPromise, {
      quiet: true,
      throwOnError: this.#throwOnError,
      env: this.#perEnv,
      cwd: this.#perCwd,
    });
  }

  nothrow() {
    return new ShellResult(this.#rawPromise, {
      quiet: this.#quiet,
      throwOnError: false,
      env: this.#perEnv,
      cwd: this.#perCwd,
    });
  }

  env(envObj) {
    return new ShellResult(this.#rawPromise, {
      quiet: this.#quiet,
      throwOnError: this.#throwOnError,
      env: envObj,
      cwd: this.#perCwd,
    });
  }

  cwd(path) {
    return new ShellResult(this.#rawPromise, {
      quiet: this.#quiet,
      throwOnError: this.#throwOnError,
      env: this.#perEnv,
      cwd: path,
    });
  }

  get exitCode() {
    return this.#rawPromise.then((r) => r.exitCode);
  }
}

// --- $ shell function ---

function shell(strings, ...values) {
  if (!Array.isArray(strings) || !strings.raw) {
    // Direct call: $(command)
    return new ShellResult(
      Promise.resolve(strings).then((cmd) => runCommand(cmd)),
      { throwOnError: globalConfig.throwOnError }
    );
  }

  // Tagged template: $`command ${arg1} ${arg2}`
  let cmd = "";
  for (let i = 0; i < strings.length; i++) {
    cmd += strings[i];
    if (i < values.length) {
      const val = values[i];
      if (typeof val === "object" && val !== null && val.raw !== undefined) {
        // { raw: 'str' } — bypass escaping
        cmd += val.raw;
      } else if (Array.isArray(val)) {
        // Array of arguments — join with space
        cmd += val.map((v) => quote(String(v))).join(" ");
      } else if (typeof val === "object" && val !== null && val._fragment) {
        // Shell fragment
        cmd += val.cmd;
      } else {
        cmd += quote(String(val));
      }
    }
  }

  return new ShellResult(runCommand(cmd.trim(), {
    cwd: globalConfig.cwd,
    env: globalConfig.env,
  }), { throwOnError: globalConfig.throwOnError });
}

// --- Helper functions ---

function quote(arg) {
  if (arg === "") return "''";
  // POSIX single-quote escaping for strings with special characters
  if (/[^a-zA-Z0-9._\-\/:=+@%]/.test(arg)) {
    return "'" + arg.replace(/'/g, "'\\''") + "'";
  }
  return arg;
}

async function runCommand(cmd, options = {}) {
  const cwd = options.cwd || globalConfig.cwd || undefined;
  const env = options.env !== undefined ? options.env : globalConfig.env;

  try {
    const { stdout, stderr } = await execFile("sh", ["-c", cmd], {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
      cwd,
      env: env === undefined ? process.env : env,
    });
    return { stdout: stdout ?? "", stderr: stderr ?? "", exitCode: 0 };
  } catch (err) {
    return {
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
      exitCode: err.status ?? err.code ?? 1,
    };
  }
}

// --- $.escape() ---

function escapeString(str) {
  return str.replace(/([\$`"\\!|&;()<>*?{}\[\]~\n\r])/g, "\\$1");
}

// --- $.braces() ---

function braces(str) {
  const match = str.match(/\{([^{}]+)\}/);
  if (!match) return [str];
  const items = match[1].split(",");
  return items.map(
    (item) => str.slice(0, match.index) + item + str.slice(match.index + match[0].length)
  );
}

// --- Glob support in shell ---

function shellGlob(pattern) {
  return { _fragment: true, cmd: pattern, args: [] };
}

// --- Exports ---

const $ = shell;
$.glob = shellGlob;
$.nothrow = () => { globalConfig.throwOnError = false; };
$.throws = (v) => { globalConfig.throwOnError = v; };
$.env = (v) => { globalConfig.env = v; };
$.cwd = (v) => { globalConfig.cwd = v; };
$.escape = escapeString;
$.braces = braces;

export { shell, $, ShellResult, ShellError };
export default { shell, $, ShellResult, ShellError };
