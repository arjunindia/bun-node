// bun:transpiler type definitions

export interface TranspilerOptions {
  loader?: "js" | "jsx" | "ts" | "tsx";
  target?: "browser" | "node" | "esnext";
  define?: Record<string, string>;
  jsx?: "transform" | "automatic" | "preserve";
  jsxFactory?: string;
  jsxFragment?: string;
  tsconfigRaw?: string;
  autoImportJSX?: boolean;
  allowBunRuntime?: boolean;
}

export interface ScanResult {
  imports: { path: string; kind: string }[];
  exports: string[];
}

export class Transpiler {
  constructor(options?: TranspilerOptions);
  transform(source: string): Promise<string>;
  transformSync(source: string): string;
  scan(source: string): ScanResult;
  scanImports(source: string): { path: string; kind: string }[];
}
