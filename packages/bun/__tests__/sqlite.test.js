import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Database, Statement, constants } from "../sqlite.js";

let db;

beforeEach(() => {
  db = new Database(":memory:");
});

afterEach(() => {
  db.close();
});

// --- Database construction ---

describe("Database constructor", () => {
  it("creates in-memory database with :memory:", () => {
    const d = new Database(":memory:");
    expect(d).toBeDefined();
    d.close();
  });

  it("creates in-memory database with empty string", () => {
    const d = new Database("");
    expect(d).toBeDefined();
    d.close();
  });

  it("creates in-memory database with no args", () => {
    const d = new Database();
    expect(d).toBeDefined();
    d.close();
  });

  it("accepts strict option", () => {
    const d = new Database(":memory:", { strict: true });
    expect(d).toBeDefined();
    d.close();
  });

  it("accepts safeIntegers option", () => {
    const d = new Database(":memory:", { safeIntegers: true });
    expect(d).toBeDefined();
    d.close();
  });
});

// --- Basic query ---

describe("db.query()", () => {
  it("returns a Statement", () => {
    db.run("CREATE TABLE test (id INTEGER, name TEXT)");
    const stmt = db.query("SELECT * FROM test");
    expect(stmt).toBeDefined();
  });

  it("returns cached Statement on repeated calls", () => {
    db.run("CREATE TABLE test (id INTEGER)");
    const stmt1 = db.query("SELECT * FROM test");
    const stmt2 = db.query("SELECT * FROM test");
    expect(stmt1).toBe(stmt2);
  });
});

describe("db.prepare()", () => {
  it("returns a fresh Statement each time", () => {
    db.run("CREATE TABLE test (id INTEGER)");
    const stmt1 = db.prepare("SELECT * FROM test");
    const stmt2 = db.prepare("SELECT * FROM test");
    expect(stmt1).not.toBe(stmt2);
  });
});

// --- Statement.all() ---

describe("Statement.all()", () => {
  it("returns all rows as objects", () => {
    db.run("CREATE TABLE test (id INTEGER, name TEXT)");
    db.run("INSERT INTO test VALUES (?, ?)", [1, "Alice"]);
    db.run("INSERT INTO test VALUES (?, ?)", [2, "Bob"]);

    const rows = db.query("SELECT * FROM test").all();
    expect(rows).toEqual([
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ]);
  });

  it("returns empty array when no rows", () => {
    db.run("CREATE TABLE test (id INTEGER)");
    const rows = db.query("SELECT * FROM test").all();
    expect(rows).toEqual([]);
  });

  it("works with named params", () => {
    db.run("CREATE TABLE test (name TEXT)");
    db.run("INSERT INTO test VALUES (?)", ["Alice"]);
    const rows = db.query("SELECT * FROM test WHERE name = $name").all({ $name: "Alice" });
    expect(rows).toEqual([{ name: "Alice" }]);
  });

  it("works with positional params", () => {
    db.run("CREATE TABLE test (name TEXT)");
    db.run("INSERT INTO test VALUES (?)", ["Alice"]);
    const rows = db.query("SELECT * FROM test WHERE name = ?").all("Alice");
    expect(rows).toEqual([{ name: "Alice" }]);
  });
});

// --- Statement.get() ---

describe("Statement.get()", () => {
  it("returns first row as object", () => {
    db.run("CREATE TABLE test (id INTEGER, name TEXT)");
    db.run("INSERT INTO test VALUES (?, ?)", [1, "Alice"]);
    db.run("INSERT INTO test VALUES (?, ?)", [2, "Bob"]);

    const row = db.query("SELECT * FROM test").get();
    expect(row).toEqual({ id: 1, name: "Alice" });
  });

  it("returns undefined when no rows", () => {
    db.run("CREATE TABLE test (id INTEGER)");
    const row = db.query("SELECT * FROM test").get();
    expect(row).toBeUndefined();
  });

  it("works with named params", () => {
    db.run("CREATE TABLE test (name TEXT, age INTEGER)");
    db.run("INSERT INTO test VALUES (?, ?)", ["Alice", 30]);
    const row = db.query("SELECT * FROM test WHERE name = $name").get({ $name: "Alice" });
    expect(row).toEqual({ name: "Alice", age: 30 });
  });
});

// --- Statement.run() ---

describe("Statement.run()", () => {
  it("returns { lastInsertRowid, changes }", () => {
    db.run("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)");
    const result = db.query("INSERT INTO test VALUES (?, ?)").run(1, "Alice");
    expect(result).toHaveProperty("lastInsertRowid");
    expect(result).toHaveProperty("changes");
    expect(result.changes).toBe(1);
  });

  it("works with named params", () => {
    db.run("CREATE TABLE test (name TEXT)");
    const result = db.query("INSERT INTO test VALUES ($name)").run({ $name: "Alice" });
    expect(result.changes).toBe(1);
  });
});

// --- Statement.values() ---

describe("Statement.values()", () => {
  it("returns rows as arrays", () => {
    db.run("CREATE TABLE test (id INTEGER, name TEXT)");
    db.run("INSERT INTO test VALUES (?, ?)", [1, "Alice"]);
    const rows = db.query("SELECT * FROM test").values();
    expect(rows).toEqual([[1, "Alice"]]);
  });
});

// --- Statement.as() ---

describe("Statement.as()", () => {
  it("maps results to class instances", () => {
    class User {
      get isAdult() {
        return this.age >= 18;
      }
    }

    db.run("CREATE TABLE users (name TEXT, age INTEGER)");
    db.run("INSERT INTO users VALUES (?, ?)", ["Alice", 30]);
    db.run("INSERT INTO users VALUES (?, ?)", ["Bob", 15]);

    const users = db.query("SELECT * FROM users").as(User).all();
    expect(users[0]).toBeInstanceOf(User);
    expect(users[0].name).toBe("Alice");
    expect(users[0].isAdult).toBe(true);
    expect(users[1].isAdult).toBe(false);
  });

  it("works with get()", () => {
    class Movie {
      get isOld() {
        return this.year < 2000;
      }
    }

    db.run("CREATE TABLE movies (title TEXT, year INTEGER)");
    db.run("INSERT INTO movies VALUES (?, ?)", ["Toy Story", 1995]);

    const movie = db.query("SELECT * FROM movies").as(Movie).get();
    expect(movie).toBeInstanceOf(Movie);
    expect(movie.isOld).toBe(true);
  });

  it("returns the same Statement for chaining", () => {
    db.run("CREATE TABLE test (id INTEGER)");
    const stmt = db.query("SELECT * FROM test");
    expect(stmt.as(class {})).toBe(stmt);
  });
});

// --- Statement iteration ---

describe("Statement iteration", () => {
  it("supports for...of via iterate()", () => {
    db.run("CREATE TABLE test (id INTEGER)");
    db.run("INSERT INTO test VALUES (?)", [1]);
    db.run("INSERT INTO test VALUES (?)", [2]);
    db.run("INSERT INTO test VALUES (?)", [3]);

    const ids = [];
    for (const row of db.query("SELECT * FROM test").iterate()) {
      ids.push(row.id);
    }
    expect(ids).toEqual([1, 2, 3]);
  });

  it("supports for...of directly on Statement", () => {
    db.run("CREATE TABLE test (id INTEGER)");
    db.run("INSERT INTO test VALUES (?)", [1]);
    db.run("INSERT INTO test VALUES (?)", [2]);

    const ids = [];
    for (const row of db.query("SELECT * FROM test")) {
      ids.push(row.id);
    }
    expect(ids).toEqual([1, 2]);
  });
});

// --- Transactions ---

describe("db.transaction()", () => {
  it("wraps a function in a transaction", () => {
    db.run("CREATE TABLE test (id INTEGER, name TEXT)");
    const insert = db.prepare("INSERT INTO test VALUES (?, ?)");
    const insertMany = db.transaction((items) => {
      for (const item of items) insert.run(item.id, item.name);
    });

    insertMany([
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
      { id: 3, name: "Charlie" },
    ]);

    const rows = db.query("SELECT * FROM test").all();
    expect(rows).toHaveLength(3);
  });

  it("returns the transaction function result", () => {
    db.run("CREATE TABLE test (id INTEGER)");
    const insert = db.prepare("INSERT INTO test VALUES (?)");
    const insertAndCount = db.transaction((ids) => {
      for (const id of ids) insert.run(id);
      return ids.length;
    });

    const count = insertAndCount([1, 2, 3]);
    expect(count).toBe(3);
  });

  it("supports nested transactions", () => {
    db.run("CREATE TABLE test (id INTEGER, name TEXT)");
    const insert = db.prepare("INSERT INTO test VALUES (?, ?)");

    const inner = db.transaction((items) => {
      for (const item of items) insert.run(item.id, item.name);
    });

    const outer = db.transaction((data) => {
      insert.run(0, "zero");
      inner(data);
    });

    outer([
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ]);

    const rows = db.query("SELECT * FROM test").all();
    expect(rows).toHaveLength(3);
  });

  it("has deferred/immediate/exclusive variants", () => {
    const fn = db.transaction(() => {});
    expect(typeof fn.deferred).toBe("function");
    expect(typeof fn.immediate).toBe("function");
    expect(typeof fn.exclusive).toBe("function");
  });
});

// --- db.run() ---

describe("db.run()", () => {
  it("executes SQL and returns metadata", () => {
    db.run("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)");
    const result = db.run("INSERT INTO test VALUES (?, ?)", [1, "Alice"]);
    expect(result.changes).toBe(1);
    expect(result.lastInsertRowid).toBeGreaterThan(0);
  });

  it("executes multiple statements", () => {
    const result = db.run("CREATE TABLE test (id INTEGER); CREATE TABLE test2 (name TEXT)");
    expect(result).toHaveProperty("changes");
  });
});

// --- db.exec (alias for db.run) ---

describe("db.exec", () => {
  it("is an alias for db.run", () => {
    expect(db.exec).toBe(db.run);
  });
});

// --- db.serialize() / Database.deserialize() ---

describe("db.serialize() / Database.deserialize()", () => {
  it("serializes database to Uint8Array", () => {
    db.run("CREATE TABLE test (id INTEGER, name TEXT)");
    db.run("INSERT INTO test VALUES (?, ?)", [1, "Alice"]);
    const data = db.serialize();
    expect(data).toBeInstanceOf(Uint8Array);
    expect(data.length).toBeGreaterThan(0);
  });

  it("deserializes back to a working database", () => {
    db.run("CREATE TABLE test (id INTEGER, name TEXT)");
    db.run("INSERT INTO test VALUES (?, ?)", [1, "Alice"]);
    const data = db.serialize();

    const db2 = Database.deserialize(data);
    const rows = db2.query("SELECT * FROM test").all();
    expect(rows).toEqual([{ id: 1, name: "Alice" }]);
    db2.close();
  });
});

// --- Strict mode ---

describe("strict mode", () => {
  it("allows binding without prefix when strict: true", () => {
    const d = new Database(":memory:", { strict: true });
    d.run("CREATE TABLE test (name TEXT)");
    d.run("INSERT INTO test VALUES ($name)", { name: "Alice" });
    const row = d.query("SELECT * FROM test WHERE name = $name").get({ name: "Alice" });
    expect(row).toEqual({ name: "Alice" });
    d.close();
  });

  it("throws when prefix is used with strict: true", () => {
    const d = new Database(":memory:", { strict: true });
    d.run("CREATE TABLE test (name TEXT)");
    expect(() => {
      d.query("SELECT * FROM test WHERE name = $name").all({ $name: "Alice" });
    }).toThrow();
    d.close();
  });
});

// --- db.close() ---

describe("db.close()", () => {
  it("closes the database", () => {
    const d = new Database(":memory:");
    d.run("CREATE TABLE test (id INTEGER)");
    d.close();
    expect(() => d.run("SELECT * FROM test")).toThrow();
  });

  it("does not throw when throwOnError is false", () => {
    const d = new Database(":memory:");
    expect(() => d.close(false)).not.toThrow();
  });
});

// --- Statement properties ---

describe("Statement properties", () => {
  it("columnNames returns column names", () => {
    db.run("CREATE TABLE test (id INTEGER, name TEXT)");
    db.run("INSERT INTO test VALUES (?, ?)", [1, "Alice"]);
    const stmt = db.query("SELECT id, name FROM test");
    // Run once to populate columns
    stmt.all();
    expect(stmt.columnNames).toEqual(["id", "name"]);
  });

  it("paramsCount returns parameter count", () => {
    const stmt = db.prepare("SELECT ?, ?, ?");
    expect(stmt.paramsCount).toBe(3);
  });
});

// --- Statement.toString() ---

describe("Statement.toString()", () => {
  it("returns the SQL source", () => {
    db.run("CREATE TABLE test (id INTEGER)");
    const sql = "SELECT * FROM test WHERE id = ?";
    const stmt = db.prepare(sql);
    expect(stmt.toString()).toBe(sql);
  });
});

// --- constants ---

describe("constants", () => {
  it("exports SQLITE_FCNTL_PERSIST_WAL", () => {
    expect(constants.SQLITE_FCNTL_PERSIST_WAL).toBe(10);
  });

  it("exports various SQLITE constants", () => {
    expect(typeof constants.SQLITE_LOCK_NONE).toBe("number");
    expect(typeof constants.SQLITE_OPEN_READONLY).toBe("number");
  });
});

// --- Named params with different prefixes ---

describe("Named parameter prefixes", () => {
  it("accepts $ prefix", () => {
    db.run("CREATE TABLE test (name TEXT)");
    db.run("INSERT INTO test VALUES ($name)", { $name: "Alice" });
    const row = db.query("SELECT * FROM test").get();
    expect(row.name).toBe("Alice");
  });

  it("accepts : prefix", () => {
    db.run("CREATE TABLE test (name TEXT)");
    db.run("INSERT INTO test VALUES (:name)", { ":name": "Alice" });
    const row = db.query("SELECT * FROM test").get();
    expect(row.name).toBe("Alice");
  });

  it("accepts @ prefix", () => {
    db.run("CREATE TABLE test (name TEXT)");
    db.run("INSERT INTO test VALUES (@name)", { "@name": "Alice" });
    const row = db.query("SELECT * FROM test").get();
    expect(row.name).toBe("Alice");
  });
});

// --- Blob handling ---

describe("BLOB handling", () => {
  it("returns BLOB as Uint8Array", () => {
    db.run("CREATE TABLE test (data BLOB)");
    const input = new Uint8Array([1, 2, 3, 4]);
    db.run("INSERT INTO test VALUES (?)", [Buffer.from(input)]);
    const row = db.query("SELECT data FROM test").get();
    expect(row.data).toBeInstanceOf(Buffer);
    expect([...row.data]).toEqual([1, 2, 3, 4]);
  });
});

// --- bigint support ---

describe("bigint support", () => {
  it("returns integers as bigint with safeIntegers", () => {
    const d = new Database(":memory:", { safeIntegers: true });
    d.run("CREATE TABLE test (val INTEGER)");
    d.run("INSERT INTO test VALUES (?)", [BigInt("9007199254741093")]);
    const row = d.query("SELECT val FROM test").get();
    expect(typeof row.val).toBe("bigint");
    d.close();
  });
});
