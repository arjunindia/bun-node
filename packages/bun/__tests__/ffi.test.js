import { describe, it, expect } from "vitest";
import { FFIType, suffix, dlopen, linkSymbols, CString, JSCallback, ptr, toBuffer } from "../ffi.js";
import { expect as bunExpect } from "../test.js";
import os from "node:os";

// Platform-specific C library path
const clib = process.platform === "win32"
  ? "ucrtbase.dll"
  : process.platform === "darwin"
    ? "libSystem.B.dylib"
    : "libc.so.6";

// --- Exports ---

describe("bun:ffi exports", () => {
  it("exports FFIType enum", () => {
    expect(typeof FFIType).toBe("object");
    expect(FFIType.void).toBe("void");
    expect(FFIType.i32).toBe("int32");
    expect(FFIType.cstring).toBe("pointer");
  });

  it("exports suffix for current platform", () => {
    expect(typeof suffix).toBe("string");
    if (process.platform === "win32") expect(suffix).toBe("dll");
    else if (process.platform === "darwin") expect(suffix).toBe("dylib");
    else expect(suffix).toBe("so");
  });

  it("exports dlopen function", () => {
    expect(typeof dlopen).toBe("function");
  });

  it("exports linkSymbols function", () => {
    expect(typeof linkSymbols).toBe("function");
  });

  it("exports CString constant", () => {
    expect(CString).toBe("pointer");
  });

  it("exports JSCallback function", () => {
    expect(typeof JSCallback).toBe("function");
  });

  it("exports ptr function", () => {
    expect(typeof ptr).toBe("function");
  });

  it("exports toBuffer function", () => {
    expect(typeof toBuffer).toBe("function");
  });
});

// --- dlopen ---

describe("dlopen", () => {
  it("loads a native library", () => {
    const lib = dlopen(clib, {
      abs: {
        args: [FFIType.i32],
        returns: FFIType.i32,
      },
    });
    expect(lib).toBeDefined();
    expect(lib.symbols).toBeDefined();
    expect(typeof lib.symbols.abs).toBe("function");
  });

  it("calls abs(-42) and returns 42", () => {
    const lib = dlopen(clib, {
      abs: {
        args: [FFIType.i32],
        returns: FFIType.i32,
      },
    });
    expect(lib.symbols.abs(-42)).toBe(42);
    expect(lib.symbols.abs(0)).toBe(0);
    expect(lib.symbols.abs(100)).toBe(100);
  });

  it("loads strlen as a function", () => {
    const lib = dlopen(clib, {
      strlen: {
        args: [FFIType.cstring],
        returns: FFIType.u64,
      },
    });
    expect(typeof lib.symbols.strlen).toBe("function");
  });

  it("loads multiple symbols at once", () => {
    const lib = dlopen(clib, {
      abs: { args: [FFIType.i32], returns: FFIType.i32 },
      labs: { args: [FFIType.i64], returns: FFIType.i64 },
    });
    expect(typeof lib.symbols.abs).toBe("function");
    expect(typeof lib.symbols.labs).toBe("function");
  });

  it("throws for non-existent library", () => {
    expect(() => {
      dlopen("nonexistent_library_12345.dll", {
        func: { args: [], returns: FFIType.void },
      });
    }).toThrow();
  });
});

// --- ptr ---

describe("ptr", () => {
  it("returns Buffer as-is", () => {
    const buf = Buffer.from("hello");
    const result = ptr(buf);
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it("converts ArrayBuffer to Buffer", () => {
    const ab = new ArrayBuffer(4);
    const result = ptr(ab);
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it("converts Uint8Array to Buffer", () => {
    const u8 = new Uint8Array([1, 2, 3]);
    const result = ptr(u8);
    expect(Buffer.isBuffer(result)).toBe(true);
  });
});

// --- toBuffer ---

describe("toBuffer", () => {
  it("returns empty buffer for null", () => {
    const result = toBuffer(null, 10);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("returns subarray for Buffer with size", () => {
    const buf = Buffer.from("hello world");
    const result = toBuffer(buf, 5);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBe(5);
  });
});

// --- FFIType ---

describe("FFIType", () => {
  it("has all expected types", () => {
    expect(FFIType.void).toBe("void");
    expect(FFIType.bool).toBe("bool");
    expect(FFIType.i8).toBe("int8");
    expect(FFIType.i16).toBe("int16");
    expect(FFIType.i32).toBe("int32");
    expect(FFIType.i64).toBe("int64");
    expect(FFIType.u8).toBe("uint8");
    expect(FFIType.u16).toBe("uint16");
    expect(FFIType.u32).toBe("uint32");
    expect(FFIType.u64).toBe("uint64");
    expect(FFIType.f32).toBe("float");
    expect(FFIType.f64).toBe("double");
    expect(FFIType.pointer).toBe("pointer");
    expect(FFIType.cstring).toBe("pointer");
  });
});

// --- linkSymbols ---

describe("linkSymbols", () => {
  it("returns an object with symbols", () => {
    const result = linkSymbols({});
    expect(result).toBeDefined();
    expect(result.symbols).toBeDefined();
  });
});

// --- Int64 / BigInt support ---

describe("Int64 / BigInt", () => {
  it("_abs64 works with large values on Windows", () => {
    const fn = process.platform === "win32" ? "_abs64" : "labs";
    const lib = dlopen(clib, {
      [fn]: { args: [FFIType.i64], returns: FFIType.i64 },
    });
    const result = lib.symbols[fn](-1000000000000);
    expect(typeof result).toBe("number");
    expect(result).toBe(1000000000000);
  });

  it("i64 returns a number", () => {
    const fn = process.platform === "win32" ? "_abs64" : "labs";
    const lib = dlopen(clib, {
      [fn]: { args: [FFIType.i64], returns: FFIType.i64 },
    });
    const result = lib.symbols[fn](42);
    expect(typeof result).toBe("number");
    expect(result).toBe(42);
  });
});

// --- Float / Double ---

describe("float / double", () => {
  it("fabs returns absolute value of double", () => {
    const lib = dlopen(clib, {
      fabs: { args: [FFIType.f64], returns: FFIType.f64 },
    });
    expect(lib.symbols.fabs(-3.14)).toBeCloseTo(3.14, 5);
    expect(lib.symbols.fabs(0.0)).toBe(0);
  });
});
