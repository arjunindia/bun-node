# Bun Child Processes (Spawn)

> Spawn child processes with `Bun.spawn` or `Bun.spawnSync`

## Spawn a process (`Bun.spawn()`)

Provide a command as an array of strings. The result of `Bun.spawn()` is a `Bun.Subprocess` object.

```ts
const proc = Bun.spawn(["bun", "--version"]);
console.log(await proc.exited); // 0
```

The second argument to `Bun.spawn` is a parameters object that can be used to configure the subprocess.

```ts
const proc = Bun.spawn(["bun", "--version"], {
  cwd: "./path/to/subdir",
  env: { ...process.env, FOO: "bar" },
  onExit(proc, exitCode, signalCode, error) {
    // exit handler
  },
});

proc.pid; // process ID of subprocess
```

## Input stream

By default, the input stream of the subprocess is undefined; it can be configured with the `stdin` parameter.

```ts
const proc = Bun.spawn(["cat"], {
  stdin: await fetch("https://raw.githubusercontent.com/oven-sh/bun/main/examples/hashing.js"),
});

const text = await proc.stdout.text();
console.log(text);
```

| Value | Description |
| --- | --- |
| `null` | **Default.** Provide no input to the subprocess |
| `"pipe"` | Return a `FileSink` for fast incremental writing |
| `"inherit"` | Inherit the `stdin` of the parent process |
| `Bun.file()` | Read from the specified file |
| `TypedArray \| DataView` | Use a binary buffer as input |
| `Response` | Use the response `body` as input |
| `Request` | Use the request `body` as input |
| `ReadableStream` | Use a readable stream as input |
| `Blob` | Use a blob as input |
| `number` | Read from the file with a given file descriptor |

### Incremental writing with `"pipe"`:

```ts
const proc = Bun.spawn(["cat"], {
  stdin: "pipe",
});

proc.stdin.write("hello");
const enc = new TextEncoder();
proc.stdin.write(enc.encode(" world!"));
proc.stdin.flush();
proc.stdin.end();
```

### Piping a ReadableStream:

```ts
const stream = new ReadableStream({
  start(controller) {
    controller.enqueue("Hello from ");
    controller.enqueue("ReadableStream!");
    controller.close();
  },
});

const proc = Bun.spawn(["cat"], {
  stdin: stream,
  stdout: "pipe",
});

const output = await proc.stdout.text();
console.log(output); // "Hello from ReadableStream!"
```

## Output streams

By default these are instances of `ReadableStream`.

```ts
const proc = Bun.spawn(["bun", "--version"]);
const text = await proc.stdout.text();
console.log(text); // => "1.3.3\n"
```

Configure the output stream:

| Value | Description |
| --- | --- |
| `"pipe"` | **Default for `stdout`.** Pipe the output to a `ReadableStream` |
| `"inherit"` | **Default for `stderr`.** Inherit from the parent process |
| `"ignore"` | Discard the output |
| `Bun.file()` | Write to the specified file |
| `number` | Write to the file with the given file descriptor |

## Exit handling

```ts
const proc = Bun.spawn(["bun", "--version"], {
  onExit(proc, exitCode, signalCode, error) {
    // exit handler
  },
});
```

The `exited` property is a `Promise` that resolves when the process exits:

```ts
const proc = Bun.spawn(["bun", "--version"]);

await proc.exited;
proc.killed;    // boolean — was the process killed?
proc.exitCode;  // null | number
proc.signalCode; // null | "SIGABRT" | "SIGALRM" | ...
```

### Killing a process

```ts
const proc = Bun.spawn(["bun", "--version"]);
proc.kill();
proc.killed; // true

proc.kill(15);           // specify a signal code
proc.kill("SIGTERM");    // specify a signal name
```

The parent `bun` process will not terminate until all child processes have exited. Use `proc.unref()` to detach:

```ts
const proc = Bun.spawn(["bun", "--version"]);
proc.unref();
```

## Resource usage

```ts
const proc = Bun.spawn(["bun", "--version"]);
await proc.exited;

const usage = proc.resourceUsage();
console.log(`Max memory used: ${usage.maxRSS} bytes`);
console.log(`CPU time (user): ${usage.cpuTime.user} µs`);
console.log(`CPU time (system): ${usage.cpuTime.system} µs`);
```

## Using AbortSignal

```ts
const controller = new AbortController();
const { signal } = controller;

const proc = Bun.spawn({
  cmd: ["sleep", "100"],
  signal,
});

// Later, to abort the process:
controller.abort();
```

## Using timeout and killSignal

```ts
// Kill the process after 5 seconds
const proc = Bun.spawn({
  cmd: ["sleep", "10"],
  timeout: 5000,
});

await proc.exited; // Will resolve after 5 seconds
```

By default, timed-out processes are killed with `SIGTERM`. You can specify a different signal:

```ts
const proc = Bun.spawn({
  cmd: ["sleep", "10"],
  timeout: 5000,
  killSignal: "SIGKILL",
});
```

## Using maxBuffer

For spawnSync, limit the maximum number of bytes of output before the process is killed:

```ts
const result = Bun.spawnSync({
  cmd: ["yes"],
  maxBuffer: 100,
});
```

## Inter-process communication (IPC)

To receive messages from a spawned Bun subprocess, specify an `ipc` handler:

```ts
const child = Bun.spawn(["bun", "child.ts"], {
  ipc(message) {
    // The message received from the sub process
  },
});
```

Parent sending messages:

```ts
const childProc = Bun.spawn(["bun", "child.ts"], {
  ipc(message, childProc) {
    childProc.send("Respond to child");
  },
});

childProc.send("I am your father");
```

Child process:

```ts
// child.ts
process.send("Hello from child as string");
process.send({ message: "Hello from child as object" });

process.on("message", message => {
  console.log(message);
});
```

The `serialization` option controls the communication format:
- `advanced`: (default) Serialized using JSC `serialize` API, supports cloning everything `structuredClone` supports
- `json`: Serialized using `JSON.stringify`/`JSON.parse`

To disconnect:

```ts
childProc.disconnect();
```

### IPC between Bun & Node.js

Set `serialization: "json"` for cross-engine IPC:

```js
if (typeof Bun !== "undefined") {
  const prefix = `[bun ${process.versions.bun}]`;
  const node = Bun.spawn({
    cmd: ["node", __filename],
    ipc({ message }) {
      console.log(message);
      node.send({ message: `${prefix} hey node` });
      node.kill();
    },
    stdio: ["inherit", "inherit", "inherit"],
    serialization: "json",
  });
  node.send({ message: `${prefix} hey node` });
} else {
  const prefix = `[node ${process.version}]`;
  process.on("message", ({ message }) => {
    console.log(message);
    process.send({ message: `${prefix} hey bun` });
  });
}
```

## Terminal (PTY) support

Spawn a subprocess with a pseudo-terminal (PTY):

```ts
const proc = Bun.spawn(["bash"], {
  terminal: {
    cols: 80,
    rows: 24,
    data(terminal, data) {
      process.stdout.write(data);
    },
  },
});

proc.terminal.write("echo hello\n");
await proc.exited;
proc.terminal.close();
```

### Terminal options

| Option | Description | Default |
| --- | --- | --- |
| `cols` | Number of columns | `80` |
| `rows` | Number of rows | `24` |
| `name` | Terminal type for PTY configuration | `"xterm-256color"` |
| `data` | Callback when data is received `(terminal, data) => void` | — |
| `exit` | Callback when PTY stream closes | — |
| `drain` | Callback when ready for more data `(terminal) => void` | — |

### Terminal methods

```ts
proc.terminal.write("echo hello\n");
proc.terminal.resize(120, 40);
proc.terminal.setRawMode(true);
proc.terminal.ref();
proc.terminal.unref();
proc.terminal.close();
```

### Reusable Terminal

```ts
await using terminal = new Bun.Terminal({
  cols: 80,
  rows: 24,
  data(term, data) {
    process.stdout.write(data);
  },
});

const proc1 = Bun.spawn(["echo", "first"], { terminal });
await proc1.exited;

const proc2 = Bun.spawn(["echo", "second"], { terminal });
await proc2.exited;
```

## Blocking API (`Bun.spawnSync()`)

Synchronous equivalent of `Bun.spawn`. Returns a `SyncSubprocess` object.

```ts
const proc = Bun.spawnSync(["echo", "hello"]);
console.log(proc.stdout.toString());
// => "hello\n"
```

Differences from `Subprocess`:
1. Contains a `success` property (process exited with zero exit code)
2. `stdout` and `stderr` are `Buffer` instances instead of `ReadableStream`
3. No `stdin` property

## Benchmarks

Bun's `spawnSync` spawns processes 60% faster than Node.js `child_process`.

## Reference

```ts
interface Bun {
  spawn(command: string[], options?: SpawnOptions.OptionsObject): Subprocess;
  spawnSync(command: string[], options?: SpawnOptions.OptionsObject): SyncSubprocess;

  spawn(options: { cmd: string[] } & SpawnOptions.OptionsObject): Subprocess;
  spawnSync(options: { cmd: string[] } & SpawnOptions.OptionsObject): SyncSubprocess;
}

interface Subprocess extends AsyncDisposable {
  readonly stdin: FileSink | number | undefined | null;
  readonly stdout: ReadableStream<Uint8Array> | number | undefined | null;
  readonly stderr: ReadableStream<Uint8Array> | number | undefined | null;
  readonly terminal: Terminal | undefined;
  readonly pid: number;
  readonly exited: Promise<number>;
  readonly exitCode: number | null;
  readonly signalCode: NodeJS.Signals | null;
  readonly killed: boolean;

  kill(exitCode?: number | NodeJS.Signals): void;
  ref(): void;
  unref(): void;
  send(message: any): void;
  disconnect(): void;
  resourceUsage(): ResourceUsage | undefined;
}

interface SyncSubprocess {
  stdout: Buffer | undefined;
  stderr: Buffer | undefined;
  exitCode: number;
  success: boolean;
  resourceUsage: ResourceUsage;
  signalCode?: string;
  exitedDueToTimeout?: true;
  pid: number;
}
```
