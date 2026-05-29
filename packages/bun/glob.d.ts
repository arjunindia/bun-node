export interface ScanOptions {
  cwd?: string;
  dot?: boolean;
  absolute?: boolean;
  followSymlinks?: boolean;
  throwErrorOnBrokenSymlink?: boolean;
  onlyFiles?: boolean;
}

export class Glob {
  constructor(pattern: string);
  match(path: string): boolean;
  scan(root: string | ScanOptions): AsyncIterable<string>;
  scanSync(root: string | ScanOptions): string[];
}
