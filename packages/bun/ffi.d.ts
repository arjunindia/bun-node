// bun:ffi type definitions

export const FFIType: {
  readonly void: "void";
  readonly bool: "bool";
  readonly i8: "int8";
  readonly i16: "int16";
  readonly i32: "int32";
  readonly i64: "int64";
  readonly u8: "uint8";
  readonly u16: "uint16";
  readonly u32: "uint32";
  readonly u64: "uint64";
  readonly f32: "float";
  readonly f64: "double";
  readonly pointer: "pointer";
  readonly buffer: "pointer";
  readonly function: "pointer";
  readonly char: "char";
  readonly uchar: "uchar";
  readonly short: "short";
  readonly ushort: "ushort";
  readonly int: "int";
  readonly uint: "uint";
  readonly long: "long";
  readonly ulong: "ulong";
  readonly longlong: "longlong";
  readonly ulonglong: "ulonglong";
  readonly float: "float";
  readonly double: "double";
  readonly cstring: "pointer";
  readonly ptr: "pointer";
};

export const suffix: string;

export interface FFISymbolDefinition {
  args?: any[];
  returns?: any;
}

export interface Library {
  symbols: Record<string, (...args: any[]) => any>;
}

export function dlopen(path: string, symbols: Record<string, FFISymbolDefinition>): Library;
export function linkSymbols(symbols: Record<string, FFISymbolDefinition>): { symbols: Record<string, any> };
export const CString: "pointer";
export function JSCallback(retType: any, argTypes: any[], fn: Function): any;
export function ptr(buf: Buffer | ArrayBuffer | ArrayBufferView): Buffer;
export function toBuffer(ptr: any, size?: number): Buffer;
