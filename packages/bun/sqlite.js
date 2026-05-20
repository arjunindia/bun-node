import BetterSqlite3 from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// --- Constants ---

const constants = {
  SQLITE_FCNTL_PERSIST_WAL: 10,
  SQLITE_FCNTL_POWERSAFE_OVERWRITE: 11,
  SQLITE_FCNTL_VFSNAME: 12,
  SQLITE_FCNTL_CHUNK_SIZE: 6,
  SQLITE_FCNTL_FILE_POINTER: 7,
  SQLITE_LOCK_NONE: 0,
  SQLITE_LOCK_SHARED: 1,
  SQLITE_LOCK_RESERVED: 2,
  SQLITE_LOCK_PENDING: 3,
  SQLITE_LOCK_EXCLUSIVE: 4,
  SQLITE_OPEN_READONLY: 1,
  SQLITE_OPEN_READWRITE: 2,
  SQLITE_OPEN_CREATE: 4,
  SQLITE_DELETE: 9,
  SQLITE_INSERT: 18,
  SQLITE_UPDATE: 23,
};

// --- Statement ---

class Statement {
  _stmt;
  _db;
  _strict;
  _cached;
  _classMap;
  _lastParams;

  constructor(stmt, db, strict = false, cached = false) {
    this._stmt = stmt;
    this._db = db;
    this._strict = strict;
    this._cached = cached;
    this._classMap = null;
    this._lastParams = undefined;
  }

  // --- Parameter normalization ---

  _normalizeParams(params) {
    if (params === undefined || params === null) return [];

    // Positional args passed directly
    if (typeof params !== "object" || params instanceof Date || params instanceof Buffer || ArrayBuffer.isView(params)) {
      return [params];
    }

    // Named params object — strip $/:/@ prefix unless strict
    if (!Array.isArray(params)) {
      const normalized = {};
      for (const [key, value] of Object.entries(params)) {
        if (this._strict) {
          if (key.startsWith("$") || key.startsWith(":") || key.startsWith("@")) {
            throw new Error(`Strict mode: parameter name "${key}" should not have a prefix`);
          }
          normalized[key] = value;
        } else {
          // Strip prefix
          const stripped = key.replace(/^[$:@]/, "");
          normalized[stripped] = value;
        }
      }
      return [normalized];
    }

    return params;
  }

  _wrapResult(row) {
    if (!row || !this._classMap) return row;
    const obj = Object.create(this._classMap.prototype);
    Object.assign(obj, row);
    return obj;
  }

  _wrapResults(rows) {
    if (!this._classMap) return rows;
    return rows.map((row) => this._wrapResult(row));
  }

  // --- Public methods ---

  all(...args) {
    const params = this._normalizeParams(args.length === 1 ? args[0] : args);
    this._lastParams = params;
    const rows = this._stmt.all(...params);
    return this._wrapResults(rows);
  }

  get(...args) {
    const params = this._normalizeParams(args.length === 1 ? args[0] : args);
    this._lastParams = params;
    const row = this._stmt.get(...params);
    return row ? this._wrapResult(row) : undefined;
  }

  run(...args) {
    const params = this._normalizeParams(args.length === 1 ? args[0] : args);
    this._lastParams = params;
    const result = this._stmt.run(...params);
    return {
      lastInsertRowid: Number(result.lastInsertRowid),
      changes: result.changes,
    };
  }

  values(...args) {
    const params = this._normalizeParams(args.length === 1 ? args[0] : args);
    this._lastParams = params;
    // better-sqlite3's raw mode
    const rawStmt = this._db._db.prepare(this._stmt.source);
    rawStmt.raw(true);
    return rawStmt.all(...params);
  }

  iterate(...args) {
    const params = this._normalizeParams(args.length === 1 ? args[0] : args);
    this._lastParams = params;
    const iter = this._stmt.iterate(...params);
    if (this._classMap) {
      return {
        [Symbol.iterator]() {
          return {
            next() {
              const { value, done } = iter[Symbol.iterator]().next();
              if (done) return { done: true };
              const obj = Object.create(this._classMap.prototype);
              Object.assign(obj, value);
              return { value: obj, done: false };
            },
          };
        },
      };
    }
    return iter;
  }

  [Symbol.iterator]() {
    return this.iterate()[Symbol.iterator]();
  }

  as(Class) {
    this._classMap = Class;
    return this;
  }

  finalize() {
    // better-sqlite3 doesn't have explicit finalize, but we can try
    try {
      this._stmt.raw(false);
    } catch {
      // ignore
    }
  }

  toString() {
    return this._stmt.source;
  }

  get columnNames() {
    return this._stmt.columns().map((c) => c.name);
  }

  get columnTypes() {
    return this._stmt.columns().map((c) => c.type || null);
  }

  get declaredTypes() {
    return this._stmt.columns().map((c) => c.type || null);
  }

  get paramsCount() {
    return this._countParams();
  }

  get parameterCount() {
    return this._countParams();
  }

  _countParams() {
    // Count ?N, :name, $name, @name in the SQL source
    const sql = this._stmt.source;
    const positional = (sql.match(/\?[\d]*/g) || []).length;
    const named = (sql.match(/[:@$][a-zA-Z_]\w*/g) || []).length;
    return Math.max(positional, named);
  }

  get native() {
    return this._stmt;
  }
}

// --- Database ---

class Database {
  _db;
  _strict;
  _safeIntegers;
  _queryCache;

  constructor(filename, options = {}) {
    if (filename === undefined || filename === "" || filename === ":memory:") {
      filename = ":memory:";
    }

    const opts = typeof options === "number" ? {} : options;

    // Map Bun options to better-sqlite3 options
    const bs3Opts = {
      readonly: opts.readonly ?? false,
      fileMustExist: opts.create === false ? true : false,
    };

    // better-sqlite3 native binding options
    this._db = new BetterSqlite3(filename, bs3Opts);

    this._strict = opts.strict ?? false;
    this._safeIntegers = opts.safeIntegers ?? false;
    this._queryCache = new Map();

    if (this._safeIntegers) {
      this._db.defaultSafeIntegers(true);
    }

    // exec is an alias for run (Bun behavior)
    this.exec = this.run;
  }

  query(sql) {
    if (this._queryCache.has(sql)) {
      return this._queryCache.get(sql);
    }
    const stmt = this._db.prepare(sql);
    const wrapper = new Statement(stmt, this, this._strict, true);
    this._queryCache.set(sql, wrapper);
    return wrapper;
  }

  prepare(sql) {
    const stmt = this._db.prepare(sql);
    return new Statement(stmt, this, this._strict, false);
  }

  run(sql, params) {
    // Support multi-statement by splitting on ;
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    let lastResult;
    for (const s of statements) {
      const stmt = this._db.prepare(s);
      if (params !== undefined) {
        const wrapper = new Statement(stmt, this, this._strict, false);
        lastResult = wrapper.run(params);
      } else {
        const result = stmt.run();
        lastResult = {
          lastInsertRowid: Number(result.lastInsertRowid),
          changes: result.changes,
        };
      }
    }
    return lastResult;
  }

  // exec is defined as alias for run in constructor

  transaction(fn) {
    const wrapped = this._db.transaction(fn);

    // better-sqlite3 returns a frozen function, so wrap it
    const tx = (...args) => wrapped(...args);
    tx.deferred = (...args) => wrapped(...args);
    tx.immediate = (...args) => wrapped(...args);
    tx.exclusive = (...args) => wrapped(...args);

    return tx;
  }

  close(throwOnError = false) {
    try {
      this._queryCache.clear();
      this._db.close();
    } catch (err) {
      if (throwOnError) throw err;
    }
  }

  serialize() {
    return this._db.serialize();
  }

  static deserialize(data) {
    // better-sqlite3 doesn't have a static deserialize method.
    // Write the serialized data to a temp file and open it.
    const tmpPath = path.join(os.tmpdir(), `buniso-deserialize-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    fs.writeFileSync(tmpPath, Buffer.from(data));
    const db = new Database(tmpPath);
    db._tmpPath = tmpPath;
    return db;
  }

  fileControl(cmd, value) {
    // better-sqlite3 doesn't expose file_control directly
    // Use pragma as fallback for common cases
    if (cmd === constants.SQLITE_FCNTL_PERSIST_WAL) {
      this._db.pragma(`journal_mode = WAL`);
    }
  }

  loadExtension(path) {
    this._db.loadExtension(path);
  }

  // Expose internal db for Statement access
  get _internal() {
    return this._db;
  }
}

// --- Expose internal db for Statement values() ---
Database.prototype._db_ref = null;

export { Database, Statement, constants };
export default { Database, Statement, constants };
