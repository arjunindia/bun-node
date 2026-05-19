# Bun Shell

> Use Bun's shell scripting API to run shell commands from JavaScript

Bun Shell makes shell scripting with JavaScript & TypeScript fun. It's a cross-platform bash-like shell with seamless JavaScript interop.

## Quickstart

```ts
import { $ } from "bun";

const response = await fetch("https://example.com");

// Use Response as stdin.
await $`cat < ${response} | wc -c`; // 1256
```

## Features

- **Cross-platform**: works on Windows, Linux & macOS. Instead of `rimraf` or `cross-env`, you can use Bun Shell without installing extra dependencies. Common shell commands like `ls`, `cd`, `rm` are implemented natively.
- **Familiar**: Bun Shell is a bash-like shell, supporting redirection, pipes, environment variables and more.
- **Globs**: Glob patterns are supported natively, including `**`, `*`, `{expansion}`, and more.
- **Template literals**: Template literals execute shell commands, allowing interpolation of variables and expressions.
- **Safety**: Bun Shell escapes all strings by default, preventing shell injection attacks.
- **JavaScript interop**: Use `Response`, `ArrayBuffer`, `Blob`, `Bun.file(path)` and other JavaScript objects as stdin, stdout, and stderr.
- **Shell scripting**: Bun Shell can be used to run shell scripts (`.bun.sh` files).
- **Custom interpreter**: Bun Shell is written in Zig, along with its lexer, parser, and interpreter. Bun Shell is a small programming language.

## Getting started

```js
import { $ } from "bun";

await $`echo "Hello World!"`; // Hello World!
```

By default, shell commands print to stdout. To quiet the output, call `.quiet()`:

```js
await $`echo "Hello World!"`.quiet(); // No output
```

To access the output as text, use `.text()`:

```js
const welcome = await $`echo "Hello World!"`.text();
console.log(welcome); // Hello World!\n
```

By default, `await`ing will return stdout and stderr as `Buffer`s:

```js
const { stdout, stderr } = await $`echo "Hello!"`.quiet();
console.log(stdout); // Buffer(7) [ 72, 101, 108, 108, 111, 33, 10 ]
console.log(stderr); // Buffer(0) []
```

## Error handling

Non-zero exit codes throw an error by default. The `ShellError` contains information about the command run:

```js
try {
  const output = await $`something-that-may-fail`.text();
} catch (err) {
  console.log(`Failed with code ${err.exitCode}`);
  console.log(err.stdout.toString());
  console.log(err.stderr.toString());
}
```

Disable throwing with `.nothrow()`:

```js
const { stdout, stderr, exitCode } = await $`something-that-may-fail`.nothrow().quiet();
if (exitCode !== 0) {
  console.log(`Non-zero exit code ${exitCode}`);
}
```

Global configuration:

```js
$.nothrow();   // equivalent to $.throws(false)
$.throws(true);  // default behavior
$.throws(false); // alias for $.nothrow()
```

## Redirection

Operators supported: `<`, `>` or `1>`, `2>`, `&>`, `>>` or `1>>`, `2>>`, `&>>`, `1>&2`, `2>&1`

### Redirect output to JavaScript objects (`>`)

```js
const buffer = Buffer.alloc(100);
await $`echo "Hello World!" > ${buffer}`;
console.log(buffer.toString()); // Hello World!\n
```

Supported objects for redirection to: `Buffer`, `Uint8Array`, `ArrayBuffer`, `SharedArrayBuffer`, `Bun.file(path)`, `Bun.file(fd)`

### Redirect input from JavaScript objects (`<`)

```js
const response = new Response("hello i am a response body");
const result = await $`cat < ${response}`.text();
console.log(result); // hello i am a response body
```

Supported objects for redirection from: `Buffer`, `Uint8Array`, `ArrayBuffer`, `SharedArrayBuffer`, `Bun.file(path)`, `Bun.file(fd)`, `Response`

### File redirection

```js
await $`cat < myfile.txt`;           // stdin from file
await $`echo bun! > greeting.txt`;   // stdout to file
await $`bun run index.ts 2> errors.txt`;  // stderr to file
await $`bun run ./index.ts 2>&1`;    // stderr to stdout
await $`bun run ./index.ts 1>&2`;    // stdout to stderr
```

## Piping (`|`)

```js
const result = await $`echo "Hello World!" | wc -w`.text();
console.log(result); // 2\n
```

Piping with JavaScript objects:

```js
const response = new Response("hello i am a response body");
const result = await $`cat < ${response} | wc -w`.text();
console.log(result); // 6\n
```

## Command substitution (`$(...)`)

```js
await $`echo Hash of current commit: $(git rev-parse HEAD)`;
```

Declaring shell variables:

```js
await $`
  REV=$(git rev-parse HEAD)
  docker built -t myapp:$REV
  echo Done building docker image "myapp:$REV"
`;
```

> Because Bun uses the special `raw` property on the input template literal, using backtick syntax for command substitution won't work. Use the `$(...)` syntax instead.

## Environment variables

```js
await $`FOO=foo bun -e 'console.log(process.env.FOO)'`; // foo\n
```

With string interpolation:

```js
const foo = "bar123";
await $`FOO=${foo + "456"} bun -e 'console.log(process.env.FOO)'`; // bar123456\n
```

Input is escaped by default, preventing shell injection:

```js
const foo = "bar123; rm -rf /tmp";
await $`FOO=${foo} bun -e 'console.log(process.env.FOO)'`; // bar123; rm -rf /tmp\n
```

### Changing the environment variables

```js
await $`echo $FOO`.env({ ...process.env, FOO: "bar" }); // bar
```

Global:

```js
$.env({ FOO: "bar" });
await $`echo $FOO`; // bar
await $`echo $FOO`.env({ FOO: "baz" }); // baz
```

Reset to default:

```js
$.env({ FOO: "bar" });
await $`echo $FOO`; // bar
await $`echo $FOO`.env(undefined); // ""
```

### Changing the working directory

```js
await $`pwd`.cwd("/tmp"); // /tmp
```

Global:

```js
$.cwd("/tmp");
await $`pwd`; // /tmp
await $`pwd`.cwd("/"); // /
```

## Reading output

### As string: `.text()`

```js
const result = await $`echo "Hello World!"`.text();
```

### As JSON: `.json()`

```js
const result = await $`echo '{"foo": "bar"}'`.json();
```

### Line-by-line: `.lines()`

```js
for await (let line of $`echo "Hello World!"`.lines()) {
  console.log(line);
}
```

### As Blob: `.blob()`

```js
const result = await $`echo "Hello World!"`.blob();
```

## Builtin Commands

Cross-platform builtins: `cd`, `ls`, `rm`, `echo`, `pwd`, `bun`, `cat`, `touch`, `mkdir`, `which`, `mv`, `exit`, `true`, `false`, `yes`, `seq`, `dirname`, `basename`

Partially implemented: `mv` (missing cross-device support)

## Utilities

### `$.braces` (brace expansion)

```js
await $.braces(`echo {1,2,3}`);
// => ["echo 1", "echo 2", "echo 3"]
```

### `$.escape` (escape strings)

```js
console.log($.escape('$(foo) `bar` "baz"'));
// => \$(foo) \`bar\` \"baz\"
```

To avoid escaping, wrap in `{ raw: 'str' }`:

```js
await $`echo ${{ raw: '$(foo) `bar` "baz"' }}`;
```

## `.sh` file loader

Run shell scripts with Bun:

```sh
# script.sh
echo "Hello World! pwd=$(pwd)"
```

```sh
bun ./script.sh
```

Scripts with Bun Shell are cross platform and work on Windows too.

## Security

Bun Shell does **not** invoke a system shell (`/bin/sh`). It's a re-implementation of bash running in the same Bun process, designed with security in mind.

Interpolated variables are treated as single, literal strings, protecting against command injection:

```js
const userInput = "my-file.txt; rm -rf /";
await $`ls ${userInput}`; // SAFE: treats userInput as a single string
```

### Security considerations

If you explicitly start a new shell process (e.g., `bash -c`), Bun's protections no longer apply to that new shell:

```js
const userInput = "world; touch /tmp/pwned";
// UNSAFE: You have explicitly started a new shell process
await $`bash -c "echo ${userInput}"`;
```

Argument injection is also possible — always sanitize user-provided input before passing it as an argument to an external command.

## Credits

Inspired by [zx](https://github.com/google/zx), [dax](https://github.com/dsherret/dax), and [bnx](https://github.com/wobsoriano/bnx).
