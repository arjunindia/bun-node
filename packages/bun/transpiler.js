// Bun.Transpiler — wraps esbuild's transform API
import esbuild from "esbuild";

class Transpiler {
  #options;

  constructor(options = {}) {
    this.#options = {
      loader: options.loader || "js",
      target: options.target || "esnext",
      define: options.define || {},
      jsx: options.jsx || "transform",
      jsxFactory: options.jsxFactory || "React.createElement",
      jsxFragment: options.jsxFragment || "React.Fragment",
      tsconfigRaw: options.tsconfigRaw || undefined,
      autoImportJSX: options.autoImportJSX ?? true,
      allowBunRuntime: options.allowBunRuntime ?? false,
    };
  }

  async transform(source) {
    const opts = {
      loader: this.#options.loader,
      target: this.#options.target,
      define: Object.keys(this.#options.define).length > 0 ? this.#options.define : undefined,
      jsx: this.#options.jsx,
      jsxFactory: this.#options.jsxFactory,
      jsxFragment: this.#options.jsxFragment,
      tsconfigRaw: this.#options.tsconfigRaw,
    };

    const result = await esbuild.transform(source, opts);
    return result.code;
  }

  transformSync(source) {
    const opts = {
      loader: this.#options.loader,
      target: this.#options.target,
      define: Object.keys(this.#options.define).length > 0 ? this.#options.define : undefined,
      jsx: this.#options.jsx,
      jsxFactory: this.#options.jsxFactory,
      jsxFragment: this.#options.jsxFragment,
      tsconfigRaw: this.#options.tsconfigRaw,
    };

    const result = esbuild.transformSync(source, opts);
    return result.code;
  }

  scan(source) {
    const imports = [];
    const exportsList = [];

    const importRe = /import\s+(?:{[^}]+}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;
    const exportRe = /export\s+(?:default\s+)?(?:const|let|var|function|class)\s+(\w+)/g;

    let match;
    while ((match = importRe.exec(source)) !== null) {
      imports.push({ path: match[1], kind: "import-statement" });
    }
    while ((match = exportRe.exec(source)) !== null) {
      exportsList.push(match[1]);
    }

    return { imports, exports: exportsList };
  }

  scanImports(source) {
    return this.scan(source).imports;
  }
}

export { Transpiler };
export default Transpiler;
