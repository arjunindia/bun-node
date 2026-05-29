import { describe, it, expect } from "vitest";
import { Transpiler } from "../transpiler.js";

// --- Constructor ---

describe("Transpiler constructor", () => {
  it("creates with defaults", () => {
    const t = new Transpiler();
    expect(t).toBeDefined();
  });

  it("creates with custom options", () => {
    const t = new Transpiler({
      loader: "ts",
      target: "es2018",
      jsxFactory: "h",
    });
    expect(t).toBeDefined();
  });
});

// --- transformSync ---

describe("Transpiler.transformSync", () => {
  it("transforms TypeScript to JavaScript", () => {
    const t = new Transpiler({ loader: "ts" });
    const result = t.transformSync("const x: number = 42;");
    expect(result).toBeDefined();
    expect(result).toContain("42");
    expect(result).not.toContain(": number");
  });

  it("transforms JSX", () => {
    const t = new Transpiler({ loader: "jsx" });
    const result = t.transformSync('<div className="app">Hello</div>');
    expect(result).toBeDefined();
    expect(result).toContain("createElement");
  });

  it("transforms TSX", () => {
    const t = new Transpiler({ loader: "tsx" });
    const result = t.transformSync(`
      interface Props { name: string }
      const Greet = ({ name }: Props) => <h1>Hello {name}</h1>;
    `);
    expect(result).toBeDefined();
    expect(result).toContain("createElement");
  });

  it("respects target option", () => {
    const t = new Transpiler({ loader: "js", target: "es2018" });
    const result = t.transformSync("const x = async () => 42;");
    expect(result).toBeDefined();
  });

  it("respects define option", () => {
    const t = new Transpiler({
      loader: "js",
      define: { "process.env.NODE_ENV": '"production"' },
    });
    const result = t.transformSync("console.log(process.env.NODE_ENV);");
    expect(result).toBeDefined();
    expect(result).toContain("production");
  });
});

// --- transform (async) ---

describe("Transpiler.transform (async)", () => {
  it("transforms TypeScript", async () => {
    const t = new Transpiler({ loader: "ts" });
    const result = await t.transform("const x: string = 'hello';");
    expect(result).toBeDefined();
    expect(result).toContain("hello");
  });

  it("transforms with custom options", async () => {
    const t = new Transpiler({ loader: "js" });
    const result = await t.transform("const x = 42; const y = x + 1;");
    expect(result).toBeDefined();
    expect(result).toContain("42");
  });
});

// --- scan ---

describe("Transpiler.scan", () => {
  it("detects imports", () => {
    const t = new Transpiler();
    const result = t.scan(`
      import { foo } from "./bar";
      import baz from "qux";
      const x = 1;
    `);
    expect(result.imports).toHaveLength(2);
    expect(result.imports[0].path).toBe("./bar");
    expect(result.imports[1].path).toBe("qux");
  });

  it("detects exports", () => {
    const t = new Transpiler();
    const result = t.scan(`
      export const foo = 1;
      export default function bar() {}
    `);
    expect(result.exports).toHaveLength(2);
    expect(result.exports).toContain("foo");
    expect(result.exports).toContain("bar");
  });
});

// --- scanImports ---

describe("Transpiler.scanImports", () => {
  it("returns only imports", () => {
    const t = new Transpiler();
    const imports = t.scanImports(`
      import { a } from "x";
      import b from "y";
      export const c = 1;
    `);
    expect(imports).toHaveLength(2);
    expect(imports[0].path).toBe("x");
    expect(imports[1].path).toBe("y");
  });
});
