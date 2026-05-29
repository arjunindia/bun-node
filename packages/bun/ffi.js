import koffi from "koffi";

// --- FFIType enum ---

const FFIType = {
  void: "void",
  bool: "bool",
  i8: "int8",
  i16: "int16",
  i32: "int32",
  i64: "int64",
  u8: "uint8",
  u16: "uint16",
  u32: "uint32",
  u64: "uint64",
  f32: "float",
  f64: "double",
  pointer: "pointer",
  buffer: "pointer",
  function: "pointer",
  char: "char",
  uchar: "uchar",
  short: "short",
  ushort: "ushort",
  int: "int",
  uint: "uint",
  long: "long",
  ulong: "ulong",
  longlong: "longlong",
  ulonglong: "ulonglong",
  float: "float",
  double: "double",
  cstring: "pointer",
  ptr: "pointer",
};

// --- Platform suffix ---

const suffix = process.platform === "win32" ? "dll" : process.platform === "darwin" ? "dylib" : "so";

// --- Type mapping from Bun FFI types to koffi types ---

function mapType(type) {
  if (type === undefined || type === null || type === FFIType.void || type === "void") return "void";
  if (type === FFIType.bool || type === "bool") return "bool";
  if (type === FFIType.i8 || type === "int8") return "int8";
  if (type === FFIType.i16 || type === "int16") return "int16";
  if (type === FFIType.i32 || type === "int32" || type === FFIType.int) return "int32";
  if (type === FFIType.i64 || type === "int64" || type === FFIType.longlong) return "int64";
  if (type === FFIType.u8 || type === "uint8") return "uint8";
  if (type === FFIType.u16 || type === "uint16") return "uint16";
  if (type === FFIType.u32 || type === "uint32") return "uint32";
  if (type === FFIType.u64 || type === "uint64" || type === FFIType.ulonglong) return "uint64";
  if (type === FFIType.f32 || type === "float") return "float";
  if (type === FFIType.f64 || type === "double") return "double";
  if (type === FFIType.cstring || type === "cstring" || type === FFIType.char) return "char*";
  if (type === FFIType.pointer || type === "pointer" || type === FFIType.ptr) return "void*";
  if (type === FFIType.buffer || type === "buffer") return "void*";
  if (type === "char") return "char";
  if (type === "uchar") return "uchar";
  if (type === "short") return "int16";
  if (type === "ushort") return "uint16";
  if (type === "long") return "int64";
  if (type === "ulong") return "uint64";
  return "void*";
}

// --- dlopen ---

function dlopen(path, symbols) {
  const lib = koffi.load(path);
  const result = { symbols: {} };

  for (const [name, def] of Object.entries(symbols)) {
    const retType = mapType(def.returns);
    const argTypes = (def.args || []).map(mapType);

    try {
      result.symbols[name] = lib.func(name, retType, argTypes);
    } catch (err) {
      // Try with void return if the type mapping failed
      try {
        result.symbols[name] = lib.func(name, "void", argTypes);
      } catch {
        throw new Error(`Failed to load symbol '${name}': ${err.message}`);
      }
    }
  }

  return result;
}

// --- linkSymbols (no-op for koffi — load via dlopen instead) ---

function linkSymbols(symbols) {
  // In Bun, linkSymbols links against the current process.
  // With koffi, we'd need the process handle which isn't directly available.
  // This is a stub — use dlopen instead.
  return { symbols: {} };
}

// --- CString ---

const CString = "pointer";

// --- Callback / JSCallback ---

function JSCallback(retType, argTypes, fn) {
  return koffi.register(fn, koffi.proto(mapType(retType), argTypes.map(mapType)));
}

// --- ptr / toBuffer ---

function ptr(buf) {
  if (Buffer.isBuffer(buf)) return buf;
  if (buf instanceof ArrayBuffer) return Buffer.from(buf);
  if (ArrayBuffer.isView(buf)) return Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
  return buf;
}

function toBuffer(ptr, size) {
  if (!ptr) return Buffer.alloc(0);
  // koffi returns buffers directly for pointer args
  if (Buffer.isBuffer(ptr)) return size ? ptr.subarray(0, size) : ptr;
  return Buffer.alloc(0);
}

// --- Exports ---

export {
  FFIType,
  suffix,
  dlopen,
  linkSymbols,
  CString,
  JSCallback,
  ptr,
  toBuffer,
};

export default {
  FFIType,
  suffix,
  dlopen,
  linkSymbols,
  CString,
  JSCallback,
  ptr,
  toBuffer,
};
