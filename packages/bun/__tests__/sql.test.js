import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SQL } from "../sql.js";

let sql;

afterEach(async () => {
  if (sql) await sql.close();
});

// --- SQLite adapter ---

describe("SQL with SQLite adapter", () => {
  beforeEach(async () => {
    sql = new SQL(":memory:");
    await sql`CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)`;
    await sql`INSERT INTO users VALUES (1, 'Alice', 30)`;
    await sql`INSERT INTO users VALUES (2, 'Bob', 25)`;
    await sql`INSERT INTO users VALUES (3, 'Charlie', 35)`;
  });

  it("executes a simple query", async () => {
    const rows = await sql`SELECT * FROM users`;
    expect(rows).toHaveLength(3);
  });

  it("returns row objects", async () => {
    const [row] = await sql`SELECT * FROM users WHERE id = 1`;
    expect(row.name).toBe("Alice");
    expect(row.age).toBe(30);
  });

  it("parameterizes interpolated values", async () => {
    const name = "Bob";
    const [row] = await sql`SELECT * FROM users WHERE name = ${name}`;
    expect(row.id).toBe(2);
  });

  it("handles multiple parameters", async () => {
    const minAge = 28;
    const rows = await sql`SELECT * FROM users WHERE age > ${minAge} ORDER BY age`;
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe("Alice");   // age 30 > 28
    expect(rows[1].name).toBe("Charlie"); // age 35 > 28
  });

  it("handles numeric parameters", async () => {
    const id = 1;
    const [row] = await sql`SELECT * FROM users WHERE id = ${id}`;
    expect(row.name).toBe("Alice");
  });

  it("handles null parameters", async () => {
    await sql`INSERT INTO users VALUES (4, NULL, 20)`;
    const rows = await sql`SELECT * FROM users WHERE name IS NULL`;
    expect(rows).toHaveLength(1);
  });

  it("returns empty array when no rows match", async () => {
    const rows = await sql`SELECT * FROM users WHERE id = 999`;
    expect(rows).toHaveLength(0);
  });
});

// --- .values() ---

describe("SQL .values()", () => {
  beforeEach(async () => {
    sql = new SQL(":memory:");
    await sql`CREATE TABLE test (id INTEGER, name TEXT)`;
    await sql`INSERT INTO test VALUES (1, 'Alice')`;
  });

  it("returns rows as arrays", async () => {
    const rows = await sql`SELECT * FROM test`.values();
    expect(rows).toEqual([[1, "Alice"]]);
  });
});

// --- sql() fragment helpers ---

describe("sql() fragment helpers", () => {
  beforeEach(async () => {
    sql = new SQL(":memory:");
    await sql`CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)`;
  });

  it("inserts an object with sql(obj)", async () => {
    const user = { name: "Alice", age: 30 };
    await sql`INSERT INTO users ${sql(user)}`;
    const [row] = await sql`SELECT * FROM users`;
    expect(row.name).toBe("Alice");
    expect(row.age).toBe(30);
  });

  it("inserts an object with specific columns", async () => {
    const user = { name: "Bob", age: 25, extra: "ignored" };
    await sql`INSERT INTO users ${sql(user, "name", "age")}`;
    const [row] = await sql`SELECT * FROM users`;
    expect(row.name).toBe("Bob");
  });

  it("inserts an array of objects", async () => {
    const users = [
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ];
    await sql`INSERT INTO users ${sql(users)}`;
    const rows = await sql`SELECT * FROM users`;
    expect(rows).toHaveLength(2);
  });

  it("handles WHERE IN with array", async () => {
    await sql`INSERT INTO users VALUES (1, 'Alice', 30)`;
    await sql`INSERT INTO users VALUES (2, 'Bob', 25)`;
    await sql`INSERT INTO users VALUES (3, 'Charlie', 35)`;
    const rows = await sql`SELECT * FROM users WHERE id IN ${sql([1, 3])}`;
    expect(rows).toHaveLength(2);
  });
});

// --- sql.begin() transactions ---

describe("sql.begin()", () => {
  beforeEach(async () => {
    sql = new SQL(":memory:");
    await sql`CREATE TABLE accounts (id INTEGER PRIMARY KEY, balance INTEGER)`;
    await sql`INSERT INTO accounts VALUES (1, 1000)`;
    await sql`INSERT INTO accounts VALUES (2, 500)`;
  });

  it("commits a transaction", async () => {
    await sql.begin(async (tx) => {
      await tx`UPDATE accounts SET balance = balance - 100 WHERE id = 1`;
      await tx`UPDATE accounts SET balance = balance + 100 WHERE id = 2`;
    });

    const [a1] = await sql`SELECT balance FROM accounts WHERE id = 1`;
    const [a2] = await sql`SELECT balance FROM accounts WHERE id = 2`;
    expect(a1.balance).toBe(900);
    expect(a2.balance).toBe(600);
  });

  it("rolls back on error", async () => {
    try {
      await sql.begin(async (tx) => {
        await tx`UPDATE accounts SET balance = balance - 100 WHERE id = 1`;
        throw new Error("rollback!");
      });
    } catch (e) {
      expect(e.message).toBe("rollback!");
    }

    const [a1] = await sql`SELECT balance FROM accounts WHERE id = 1`;
    expect(a1.balance).toBe(1000);
  });
});

// --- sql.close() ---

describe("sql.close()", () => {
  it("closes without error", async () => {
    const s = new SQL(":memory:");
    await s`SELECT 1`;
    await expect(s.close()).resolves.toBeUndefined();
  });
});

// --- SQL constructor ---

describe("SQL constructor", () => {
  it("accepts :memory: string", () => {
    const s = new SQL(":memory:");
    expect(s).toBeDefined();
  });

  it("accepts sqlite:// URL", () => {
    const s = new SQL("sqlite://:memory:");
    expect(s).toBeDefined();
  });

  it("accepts options object with adapter", () => {
    const s = new SQL({ adapter: "sqlite", filename: ":memory:" });
    expect(s).toBeDefined();
  });
});

// --- Error classes ---

describe("SQL error classes", () => {
  it("SQL.SQLiteError exists", () => {
    expect(SQL.SQLiteError).toBeDefined();
  });

  it("SQL.SQLError exists", () => {
    expect(SQL.SQLError).toBeDefined();
  });

  it("SQL.PostgresError exists", () => {
    expect(SQL.PostgresError).toBeDefined();
  });
});
