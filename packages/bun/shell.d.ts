// bun:shell type definitions

export class ShellError extends Error {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  constructor(message: string, exitCode: number, stdout: string, stderr: string);
}

export interface ShellOutput {
  stdout: Buffer;
  stderr: Buffer;
  exitCode: number;
}

export class ShellResult implements PromiseLike<ShellOutput> {
  then<R1 = ShellOutput, R2 = never>(
    onfulfilled?: ((value: ShellOutput) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: any) => R2 | PromiseLike<R2>) | null
  ): Promise<R1 | R2>;
  catch<R = never>(onrejected?: ((reason: any) => R | PromiseLike<R>) | null): Promise<ShellOutput | R>;
  finally(onfinally?: (() => void) | null): Promise<ShellOutput>;

  text(): Promise<string>;
  json(): Promise<any>;
  arrayBuffer(): Promise<ArrayBuffer>;
  blob(): Promise<Blob>;
  bytes(): Promise<Uint8Array>;
  lines(): AsyncIterableIterator<string>;

  quiet(): ShellResult;
  nothrow(): ShellResult;

  readonly exitCode: Promise<number>;
}

export interface ShellFunction {
  (strings: TemplateStringsArray, ...values: any[]): ShellResult;
  (command: string): ShellResult;

  /** Glob expansion helper */
  glob(pattern: string): { _fragment: true; cmd: string; args: string[] };

  /** Suppress all shell output globally */
  nothrow(): void;

  /** Control whether non-zero exit codes throw */
  throws(shouldThrow: boolean): void;

  /** Set global environment variables for all commands */
  env(env: Record<string, string> | undefined): void;

  /** Set global working directory for all commands */
  cwd(path: string): void;

  /** Escape shell metacharacters in a string */
  escape(str: string): string;

  /** Brace expansion: "{1,2,3}" → ["1", "2", "3"] */
  braces(str: string): string[];
}

export const $: ShellFunction;
export const shell: ShellFunction;
