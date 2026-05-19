# FFI

> Use Bun's FFI module to efficiently call native libraries from JavaScript

`bun:ffi` is **experimental**, with known bugs and limitations, and should not be relied on in production. The most stable way to interact with native code from Bun is to write a Node-API module.

Use the built-in `bun:ffi` module to efficiently call native libraries from JavaScript. It works with languages that support the C ABI (Zig, Rust, C/C++, C#, Nim, Kotlin, etc).

---

## dlopen usage (`bun:ffi`)

To print the version number of `sqlite3`:

```ts
import { dlopen, FFIType, suffix } from "bun:ffi";

const path = `libsqlite3.${suffix}`;

const {
  symbols: { sqlite3_libversion },
} = dlopen(path, {
  sqlite3_libversion: {
    args: [],
    returns: FFIType.cstring,
  },
});

console.log(`SQLite 3 version: ${sqlite3_libversion()}`);
```

---

## Performance

`bun:ffi` is roughly 2-6x faster than Node.js FFI via Node-API.

Bun generates & just-in-time compiles C bindings that efficiently convert values between JavaScript types and native types. To compile C, Bun embeds TinyCC, a small and fast C compiler.

---

## Usage

### Zig

```zig
// add.zig
pub export fn add(a: i32, b: i32) i32 {
  return a + b;
}
```

To compile:

```bash
zig build-lib add.zig -dynamic -OReleaseFast
```

```ts
import { dlopen, FFIType, suffix } from "bun:ffi";
const { i32 } = FFIType;

const path = `libadd.${suffix}`;

const lib = dlopen(path, {
  add: {
    args: [i32, i32],
    returns: i32,
  },
});

console.log(lib.symbols.add(1, 2));
```

### Rust

```rust
// add.rs
#[no_mangle]
pub extern "C" fn add(a: i32, b: i32) -> i32 {
    a + b
}
```

To compile:

```bash
rustc --crate-type cdylib add.rs
```

### C++

```c
#include <cstdint>

extern "C" int32_t add(int32_t a, int32_t b) {
    return a + b;
}
```

To compile:

```bash
zig build-lib add.cpp -dynamic -lc -lc++
```

---

## FFI types

The following `FFIType` values are supported.

| `FFIType`   | C Type         | Aliases                     |
| ----------- | -------------- | --------------------------- |
| buffer      | `char*`        |                             |
| cstring     | `char*`        |                             |
| function    | `(void*)(*)()` | `fn`, `callback`            |
| ptr         | `void*`        | `pointer`, `void*`, `char*` |
| i8          | `int8_t`       | `int8_t`                    |
| i16         | `int16_t`      | `int16_t`                   |
| i32         | `int32_t`      | `int32_t`, `int`            |
| i64         | `int64_t`      | `int64_t`                   |
| i64_fast    | `int64_t`      |                             |
| u8          | `uint8_t`      | `uint8_t`                   |
| u16         | `uint16_t`     | `uint16_t`                  |
| u32         | `uint32_t`     | `uint32_t`                  |
| u64         | `uint64_t`     | `uint64_t`                  |
| u64_fast    | `uint64_t`     |                             |
| f32         | `float`        | `float`                     |
| f64         | `double`       | `double`                    |
| bool        | `bool`         |                             |
| char        | `char`         |                             |
| napi_env    | `napi_env`     |                             |
| napi_value  | `napi_value`   |                             |

Note: `buffer` arguments must be a `TypedArray` or `DataView`.

---

## Strings

JavaScript strings and C-like strings are different. To solve this, `bun:ffi` exports `CString` which extends JavaScript's built-in `String` to support null-terminated strings:

```ts
class CString extends String {
  constructor(ptr: number, byteOffset?: number, byteLength?: number): string;
  ptr: number;
  byteOffset?: number;
  byteLength?: number;
}
```

To convert from a null-terminated string pointer to a JavaScript string:

```ts
const myString = new CString(ptr);
```

To convert from a pointer with a known length to a JavaScript string:

```ts
const myString = new CString(ptr, 0, byteLength);
```

The `new CString()` constructor clones the C string, so it is safe to continue using `myString` after `ptr` has been freed.

When used in `returns`, `FFIType.cstring` coerces the pointer to a JavaScript `string`. When used in `args`, `FFIType.cstring` is identical to `ptr`.

---

## Function pointers

To call a function pointer from JavaScript, use `CFunction`:

```ts
import { CFunction } from "bun:ffi";

let myNativeLibraryGetVersion = /* somehow, you got this pointer */

const getVersion = new CFunction({
  returns: "cstring",
  args: [],
  ptr: myNativeLibraryGetVersion,
});
getVersion();
```

If you have multiple function pointers, you can define them all at once with `linkSymbols`:

```ts
import { linkSymbols } from "bun:ffi";

const [majorPtr, minorPtr, patchPtr] = getVersionPtrs();

const lib = linkSymbols({
  getMajor: {
    returns: "cstring",
    args: [],
    ptr: majorPtr,
  },
  getMinor: {
    returns: "cstring",
    args: [],
    ptr: minorPtr,
  },
  getPatch: {
    returns: "cstring",
    args: [],
    ptr: patchPtr,
  },
});

const [major, minor, patch] = [
  lib.symbols.getMajor(),
  lib.symbols.getMinor(),
  lib.symbols.getPatch(),
];
```

---

## Callbacks

Use `JSCallback` to create JavaScript callback functions that can be passed to C/FFI functions:

```ts
import { dlopen, JSCallback, ptr, CString } from "bun:ffi";

const {
  symbols: { search },
  close,
} = dlopen("libmylib", {
  search: {
    returns: "usize",
    args: ["cstring", "callback"],
  },
});

const searchIterator = new JSCallback(
  (ptr, length) => /hello/.test(new CString(ptr, length)),
  {
    returns: "bool",
    args: ["ptr", "usize"],
  },
);

const str = Buffer.from("wwutwutwutwutwutwutwutwutwutwutut\0", "utf8");
if (search(ptr(str), searchIterator)) {
  // found a match!
}

setTimeout(() => {
  searchIterator.close();
  close();
}, 5000);
```

When you're done with a JSCallback, you should call `close()` to free the memory.

### Experimental thread-safe callbacks

`JSCallback` has experimental support for thread-safe callbacks:

```ts
const searchIterator = new JSCallback(
  (ptr, length) => /hello/.test(new CString(ptr, length)),
  {
    returns: "bool",
    args: ["ptr", "usize"],
    threadsafe: true, // Optional. Defaults to `false`
  },
);
```

**Performance tip:** For a slight performance boost, directly pass `JSCallback.prototype.ptr` instead of the `JSCallback` object.

---

## Pointers

Bun represents pointers as a `number` in JavaScript.

To convert from a `TypedArray` to a pointer:

```ts
import { ptr } from "bun:ffi";
let myTypedArray = new Uint8Array(32);
const myPtr = ptr(myTypedArray);
```

To convert from a pointer to an `ArrayBuffer`:

```ts
import { ptr, toArrayBuffer } from "bun:ffi";
let myTypedArray = new Uint8Array(32);
const myPtr = ptr(myTypedArray);

myTypedArray = new Uint8Array(toArrayBuffer(myPtr, 0, 32), 0, 32);
```

To read data from a pointer, use a `DataView` for long-lived pointers:

```ts
import { toArrayBuffer } from "bun:ffi";
let myDataView = new DataView(toArrayBuffer(myPtr, 0, 32));

console.log(
  myDataView.getUint8(0, true),
  myDataView.getUint8(1, true),
  myDataView.getUint8(2, true),
  myDataView.getUint8(3, true),
);
```

For short-lived pointers, use `read`:

```ts
import { read } from "bun:ffi";

console.log(
  read.u8(myPtr, 0),
  read.u8(myPtr, 1),
  read.u8(myPtr, 2),
  read.u8(myPtr, 3),
);
```

The `read` function:

| `FFIType` | `read` function |
| --------- | --------------- |
| ptr       | `read.ptr`      |
| i8        | `read.i8`       |
| i16       | `read.i16`      |
| i32       | `read.i32`      |
| i64       | `read.i64`      |
| u8        | `read.u8`       |
| u16       | `read.u16`      |
| u32       | `read.u32`      |
| u64       | `read.u64`      |
| f32       | `read.f32`      |
| f64       | `read.f64`      |

### Memory management

`bun:ffi` does not manage memory for you. You must free the memory when you're done with it.

#### From JavaScript

Use a FinalizationRegistry to track when a `TypedArray` is no longer in use.

#### From C, Rust, Zig, etc

Pass a callback and an optional context pointer to `toArrayBuffer` or `toBuffer`. This function is called once the garbage collector frees the underlying `ArrayBuffer`.

```ts
import { toArrayBuffer } from "bun:ffi";

// with a deallocatorContext:
toArrayBuffer(bytes, byteOffset, byteLength, deallocatorContext, jsTypedArrayBytesDeallocator);

// without a deallocatorContext:
toArrayBuffer(bytes, byteOffset, byteLength, jsTypedArrayBytesDeallocator);
```

### Memory safety

Using raw pointers outside of FFI is extremely not recommended.

### Passing a pointer

Where FFI functions expect a pointer, pass a `TypedArray` of equivalent size:

```ts
import { dlopen, FFIType } from "bun:ffi";

const {
  symbols: { encode_png },
} = dlopen(myLibraryPath, {
  encode_png: {
    args: ["ptr", "u32", "u32"],
    returns: FFIType.ptr,
  },
});

const pixels = new Uint8ClampedArray(128 * 128 * 4);
pixels.fill(254);

const out = encode_png(pixels, 128, 128);
```

### Reading pointers

```ts
const out = encode_png(pixels, 128, 128);

let png = new Uint8Array(toArrayBuffer(out));

await Bun.write("out.png", png);
```
