import { Database } from "./sqlite.js";
import fs from "node:fs";

// --- Error classes ---

class SQLError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "SQLError";
    this.code = code;
  }
}

class PostgresError extends SQLError {
  constructor(message, code) {
    super(message, code);
    this.name = "PostgresError";
  }
}

class SQLiteError extends SQLError {
  constructor(message, code) {
    super(message, code);
    this.name = "SQLiteError";
  }
}

// --- Query Result (thenable with chain methods) ---

class QueryResult {
  #promise;
  #executor;

  constructor(executor) {
    this.#executor = executor;
    this.#promise = null;
  }

  #run() {
    if (!this.#promise) {
      this.#promise = this.#executor();
    }
    return this.#promise;
  }

  then(onFulfilled, onRejected) {
    return this.#run().then(onFulfilled, onRejected);
  }

  catch(onRejected) {
    return this.#run().catch(onRejected);
  }

  finally(onFinally) {
    return this.#run().finally(onFinally);
  }

  values() {
    if (!this.#promise) {
      this.#promise = this.#executor({ values: true });
    }
    return this.#promise;
  }

  raw() {
    if (!this.#promise) {
      this.#promise = this.#executor({ raw: true });
    }
    return this.#promise;
  }

  simple() {
    if (!this.#promise) {
      this.#promise = this.#executor({ simple: true });
    }
    return this.#promise;
  }

  execute() {
    return this.#run();
  }

  cancel() {
    return this;
  }
}

// --- SQLite Adapter ---

class SQLiteAdapter {
  #db;
  #closed;

  constructor(filename = ":memory:") {
    this.#db = new Database(filename);
    this.#closed = false;
  }

  get type() {
    return "sqlite";
  }

  query(sql, params = [], options = {}) {
    if (this.#closed) throw new SQLError("Connection is closed");

    // Handle fragment objects
    if (params.length === 1 && params[0] !== null && typeof params[0] === "object" && params[0]._fragment) {
      const frag = params[0];
      sql = frag.sql;
      params = frag.params;
    }

    // Split multi-statement SQL and execute each
    const statements = splitSQL(sql);
    let result;

    for (const stmtSql of statements) {
      const stmt = this.#db.prepare(stmtSql);
      if (returnsData(stmtSql)) {
        if (options.values) {
          result = stmt.values(...params);
        } else {
          result = stmt.all(...params);
        }
      } else {
        result = stmt.run(...params);
      }
    }

    return result;
  }

  begin(fn) {
    if (this.#closed) throw new SQLError("Connection is closed");

    // better-sqlite3 doesn't support async transaction callbacks,
    // so we implement BEGIN/COMMIT/ROLLBACK manually
    const db = this.#db;
    const txAdapter = createSQLiteTxCallable(db);

    return (async () => {
      db.prepare("BEGIN").run();
      try {
        const result = await fn(txAdapter);
        db.prepare("COMMIT").run();
        return result;
      } catch (e) {
        db.prepare("ROLLBACK").run();
        throw e;
      }
    })();
  }

  close() {
    this.#closed = true;
    this.#db.close();
    return Promise.resolve();
  }
}

function createSQLiteTxCallable(db) {
  const executeQuery = (sql, params = [], options = {}) => {
    if (params.length === 1 && params[0] !== null && typeof params[0] === "object" && params[0]._fragment) {
      sql = params[0].sql;
      params = params[0].params;
    }
    const stmt = db.prepare(sql);
    if (returnsData(sql)) {
      return options.values ? stmt.values(...params) : stmt.all(...params);
    }
    return stmt.run(...params);
  };

  const txFn = function (strings, ...values) {
    if (Array.isArray(strings) && strings.raw) {
      const { query, params } = buildQuery(strings, values, { type: "sqlite" });
      return executeQuery(query, params);
    }
    // Fragment helper
    return buildFragment(strings, values, () => "?");
  };

  txFn.type = "sqlite";
  txFn.query = executeQuery;
  txFn.savepoint = (fn) => fn(txFn);

  return txFn;
}

// --- Postgres Adapter (lazy-loaded) ---

class PostgresAdapter {
  #sql;
  #closed;
  #url;
  #options;

  constructor(url, options = {}) {
    this.#sql = null;
    this.#closed = false;
    this.#url = url;
    this.#options = options;
  }

  async _connect() {
    if (this.#sql) return;
    try {
      const mod = await import("postgres");
      const postgres = mod.default;
      this.#sql = postgres(this.#url, this.#options);
    } catch {
      throw new SQLError("postgres package not installed. Run: npm install postgres");
    }
  }

  get type() {
    return "postgres";
  }

  async query(sql, params = [], options = {}) {
    await this._connect();
    if (this.#closed) throw new SQLError("Connection is closed");
    return this.#sql.unsafe(sql, params);
  }

  async begin(fn) {
    await this._connect();
    return this.#sql.begin(fn);
  }

  async close() {
    if (this.#sql) {
      this.#closed = true;
      await this.#sql.end();
    }
  }
}

// --- MySQL Adapter (lazy-loaded) ---

class MySQLAdapter {
  #pool;
  #closed;
  #url;
  #options;

  constructor(url, options = {}) {
    this.#pool = null;
    this.#closed = false;
    this.#url = url;
    this.#options = options;
  }

  async _connect() {
    if (this.#pool) return;
    try {
      const mod = await import("mysql2/promise");
      const mysql = mod.default || mod;
      const parsed = new URL(this.#url);
      this.#pool = mysql.createPool({
        host: parsed.hostname,
        port: Number(parsed.port) || 3306,
        user: parsed.username,
        password: parsed.password,
        database: parsed.pathname.slice(1),
        ...this.#options,
      });
    } catch {
      throw new SQLError("mysql2 package not installed. Run: npm install mysql2");
    }
  }

  get type() {
    return "mysql";
  }

  async query(sql, params = [], options = {}) {
    await this._connect();
    if (this.#closed) throw new SQLError("Connection is closed");
    const [rows] = await this.#pool.execute(sql, params);
    if (options.values) {
      return rows.map((row) => Object.values(row));
    }
    return rows;
  }

  async begin(fn) {
    await this._connect();
    const conn = await this.#pool.getConnection();
    await conn.beginTransaction();
    try {
      const txAdapter = new MySQLTxAdapter(conn);
      const result = await fn(txAdapter);
      await conn.commit();
      return result;
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  async close() {
    if (this.#pool) {
      this.#closed = true;
      await this.#pool.end();
    }
  }
}

class MySQLTxAdapter {
  #conn;

  constructor(conn) {
    this.#conn = conn;
  }

  get type() {
    return "mysql";
  }

  async query(sql, params = [], options = {}) {
    const [rows] = await this.#conn.execute(sql, params);
    if (options.values) {
      return rows.map((row) => Object.values(row));
    }
    return rows;
  }

  savepoint(fn) {
    return fn(this);
  }
}

// --- SQL helpers ---

function returnsData(sql) {
  const trimmed = sql.trimStart().toUpperCase();
  return (
    trimmed.startsWith("SELECT") ||
    trimmed.startsWith("PRAGMA") ||
    trimmed.includes(" RETURNING ") ||
    trimmed.includes(" RETURNING\n")
  );
}

function splitSQL(sql) {
  // Split on semicolons, but not inside strings
  const stmts = [];
  let current = "";
  let inString = false;
  let stringChar = "";

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (inString) {
      current += ch;
      if (ch === stringChar) inString = false;
    } else if (ch === "'" || ch === '"') {
      inString = true;
      stringChar = ch;
      current += ch;
    } else if (ch === ";") {
      const trimmed = current.trim();
      if (trimmed.length > 0) stmts.push(trimmed);
      current = "";
    } else {
      current += ch;
    }
  }
  const trimmed = current.trim();
  if (trimmed.length > 0) stmts.push(trimmed);
  return stmts;
}

// --- Fragment helpers ---

function createFragment(sql, params) {
  return { _fragment: true, sql, params };
}

function buildFragment(obj, columns, placeholderFn) {
  if (Array.isArray(obj)) {
    // Array of values for WHERE IN
    if (obj.length === 0) return createFragment("(NULL)", []);

    // Check if array of objects (batch INSERT)
    if (typeof obj[0] === "object" && obj[0] !== null && !Array.isArray(obj[0])) {
      const cols = columns.length > 0 ? columns : Object.keys(obj[0]);
      const colStr = cols.map((c) => `"${c}"`).join(", ");
      const placeholders = [];
      const params = [];

      for (const row of obj) {
        const rowPlaceholders = [];
        for (const col of cols) {
          params.push(row[col]);
          rowPlaceholders.push(placeholderFn(params.length));
        }
        placeholders.push(`(${rowPlaceholders.join(", ")})`);
      }

      return createFragment(`(${colStr}) VALUES ${placeholders.join(", ")}`, params);
    }

    // Simple array for WHERE IN
    const params = [...obj];
    const placeholders = params.map((_, i) => placeholderFn(i + 1));
    return createFragment(`(${placeholders.join(", ")})`, params);
  }

  // Single object for INSERT or UPDATE
  const cols = columns.length > 0 ? columns : Object.keys(obj);
  const colStr = cols.map((c) => `"${c}"`).join(", ");
  const params = cols.map((c) => obj[c]);
  const placeholders = params.map((_, i) => placeholderFn(i + 1));

  return createFragment(`(${colStr}) VALUES (${placeholders.join(", ")})`, params);
}

// --- Detect adapter from URL ---

function detectAdapter(urlOrOptions) {
  if (typeof urlOrOptions === "string") {
    const url = urlOrOptions;
    if (url.startsWith("sqlite://") || url === ":memory:") {
      return "sqlite";
    }
    if (url.startsWith("mysql://") || url.startsWith("mysql2://")) {
      return "mysql";
    }
    return "postgres";
  }

  if (urlOrOptions && typeof urlOrOptions === "object") {
    return urlOrOptions.adapter ?? "postgres";
  }

  return "postgres";
}

function createAdapter(urlOrOptions, options = {}) {
  const adapterType = detectAdapter(urlOrOptions);

  switch (adapterType) {
    case "sqlite": {
      let filename;
      if (typeof urlOrOptions === "string") {
        filename = urlOrOptions === ":memory:" ? ":memory:" : urlOrOptions.replace(/^sqlite:\/\//, "");
      } else {
        filename = urlOrOptions?.filename ?? ":memory:";
      }
      return new SQLiteAdapter(filename);
    }
    case "postgres": {
      const url = typeof urlOrOptions === "string" ? urlOrOptions : undefined;
      return new PostgresAdapter(url, options);
    }
    case "mysql": {
      const url = typeof urlOrOptions === "string" ? urlOrOptions : undefined;
      return new MySQLAdapter(url, options);
    }
    default:
      throw new SQLError(`Unknown adapter: ${adapterType}`);
  }
}

// --- Build parameterized query from tagged template ---

function buildQuery(strings, values, adapter) {
  const isPostgres = adapter.type === "postgres";
  const placeholderFn = isPostgres ? (n) => `$${n}` : () => "?";

  let query = "";
  const params = [];

  for (let i = 0; i < strings.length; i++) {
    query += strings[i];
    if (i < values.length) {
      const val = values[i];

      if (val !== null && typeof val === "object" && val._fragment) {
        // Inline fragment
        if (isPostgres) {
          // Re-number fragment placeholders
          const fragOffset = params.length;
          const inlined = val.sql.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + fragOffset}`);
          query += inlined;
        } else {
          // Replace any placeholders with ?
          const inlined = val.sql.replace(/\$\d+|\?/g, "?");
          query += inlined;
        }
        params.push(...val.params);
      } else {
        params.push(val);
        query += placeholderFn(params.length);
      }
    }
  }

  return { query, params };
}

// --- SQL class ---

class SQL {
  #adapter;

  constructor(urlOrOptions, options = {}) {
    this.#adapter = createAdapter(urlOrOptions, options);

    // Return a callable function instead of the instance
    const fn = this.#createCallable();

    // Store adapter reference on the function for testing
    fn._adapter = this.#adapter;
    fn._sql = this;

    return fn;
  }

  #createCallable() {
    const adapter = this.#adapter;

    // The tagged template function
    const sql = function (strings, ...values) {
      // Tagged template literals have a .raw property on the strings array
      if (Array.isArray(strings) && strings.raw) {
        const { query, params } = buildQuery(strings, values, adapter);
        return new QueryResult((options) => {
          if (options) {
            return Promise.resolve(adapter.query(query, params, options));
          }
          return Promise.resolve(adapter.query(query, params));
        });
      }

      // Direct call: sql(obj) or sql(arr) - fragment helper
      // In this case, `strings` is the actual first argument (obj/arr)
      return buildFragment(strings, values, (n) => {
        return adapter.type === "postgres" ? `$${n}` : "?";
      });
    };

    // Add methods
    sql.begin = (fnOrOpts, maybeFn) => {
      const fn = typeof fnOrOpts === "function" ? fnOrOpts : maybeFn;
      if (!fn) throw new SQLError("sql.begin() requires a callback function");
      return adapter.begin(fn);
    };

    sql.savepoint = (fn) => adapter.begin(async (tx) => fn(tx));
    sql.reserve = async () => adapter;
    sql.unsafe = (query, params = []) => {
      return new QueryResult(() => Promise.resolve(adapter.query(query, params)));
    };
    sql.file = (filePath, params = []) => {
      const content = fs.readFileSync(filePath, "utf-8");
      return new QueryResult(() => Promise.resolve(adapter.query(content, params)));
    };
    sql.close = () => adapter.close();

    // Error classes
    sql.SQLError = SQLError;
    sql.PostgresError = PostgresError;
    sql.SQLiteError = SQLiteError;

    return sql;
  }

  static SQLError = SQLError;
  static PostgresError = PostgresError;
  static SQLiteError = SQLiteError;
}

export { SQL, SQLError, PostgresError, SQLiteError };
export default { SQL, SQLError, PostgresError, SQLiteError };
