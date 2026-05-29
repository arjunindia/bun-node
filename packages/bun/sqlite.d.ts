// bun:sqlite type definitions

export interface DatabaseOptions {
  readonly?: boolean;
  create?: boolean;
  readwrite?: boolean;
  strict?: boolean;
  safeIntegers?: boolean;
}

export interface RunResult {
  lastInsertRowid: number;
  changes: number;
}

export interface ColumnDefinition {
  name: string;
  type: string | null;
}

export class Statement {
  all(...params: any[]): any[];
  get(...params: any[]): any | undefined;
  run(...params: any[]): RunResult;
  values(...params: any[]): any[][];
  iterate(...params: any[]): IterableIterator<any>;
  [Symbol.iterator](): IterableIterator<any>;
  as(Class: Function): this;
  finalize(): void;
  toString(): string;
  readonly columnNames: string[];
  readonly columnTypes: (string | null)[];
  readonly declaredTypes: (string | null)[];
  readonly paramsCount: number;
  readonly parameterCount: number;
  readonly native: any;
}

export interface TransactionFunction {
  (...args: any[]): any;
  deferred: (...args: any[]) => any;
  immediate: (...args: any[]) => any;
  exclusive: (...args: any[]) => any;
}

export class Database {
  constructor(filename?: string, options?: DatabaseOptions);
  query(sql: string): Statement;
  prepare(sql: string): Statement;
  run(sql: string, ...params: any[]): RunResult;
  transaction(fn: (...args: any[]) => any): TransactionFunction;
  close(throwOnError?: boolean): void;
  serialize(): Uint8Array;
  static deserialize(data: ArrayBufferLike): Database;
  loadExtension(path: string): void;
}

export const constants: {
  SQLITE_FCNTL_PERSIST_WAL: number;
  SQLITE_FCNTL_POWERSAFE_OVERWRITE: number;
  SQLITE_FCNTL_VFSNAME: number;
  SQLITE_FCNTL_CHUNK_SIZE: number;
  SQLITE_FCNTL_FILE_POINTER: number;
  SQLITE_LOCK_NONE: number;
  SQLITE_LOCK_SHARED: number;
  SQLITE_LOCK_RESERVED: number;
  SQLITE_LOCK_PENDING: number;
  SQLITE_LOCK_EXCLUSIVE: number;
  SQLITE_OPEN_READONLY: number;
  SQLITE_OPEN_READWRITE: number;
  SQLITE_OPEN_CREATE: number;
  SQLITE_DELETE: number;
  SQLITE_INSERT: number;
  SQLITE_UPDATE: number;
};
