// Bun.SQL type definitions

export interface SQLOptions {
  adapter?: "postgres" | "mysql" | "sqlite";
  hostname?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  max?: number;
  idleTimeout?: number;
  connectionTimeout?: number;
  ssl?: boolean | object;
  bigint?: boolean;
  prepare?: boolean;
  onconnect?: () => void;
  onclose?: () => void;
}

export class SQLError extends Error {
  code?: string;
  constructor(message: string, code?: string);
}

export class PostgresError extends SQLError {
  constructor(message: string, code?: string);
}

export class SQLiteError extends SQLError {
  constructor(message: string, code?: string);
}

export interface QueryResult<T = any> extends PromiseLike<T[]> {
  values(): Promise<any[][]>;
  raw(): Promise<any[][]>;
  simple(): Promise<any[]>;
  execute(): Promise<T[]>;
  cancel(): this;
}

export interface SQLTransaction {
  (strings: TemplateStringsArray, ...values: any[]): QueryResult;
}

export interface SQLFunction {
  (strings: TemplateStringsArray, ...values: any[]): QueryResult;
  (obj: Record<string, any>, ...columns: string[]): { _fragment: true; sql: string; params: any[] };
  (arr: any[]): { _fragment: true; sql: string; params: any[] };

  begin<T>(fn: (tx: SQLTransaction) => Promise<T>): Promise<T>;
  savepoint<T>(fn: (tx: SQLTransaction) => Promise<T>): Promise<T>;
  reserve(): Promise<any>;
  unsafe(query: string, params?: any[]): QueryResult;
  file(path: string, params?: any[]): QueryResult;
  close(): Promise<void>;

  SQLError: typeof SQLError;
  PostgresError: typeof PostgresError;
  SQLiteError: typeof SQLiteError;
}

export class SQL {
  constructor(url?: string, options?: SQLOptions);
  constructor(options?: SQLOptions);
}
