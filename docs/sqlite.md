# SQLite

> Bun natively implements a high-performance SQLite3 driver.

Bun natively implements a high-performance SQLite3 driver. To use it import from the built-in `bun:sqlite` module.

```ts
import { Database } from "bun:sqlite";

const db = new Database(":memory:");
const query = db.query("select 'Hello world' as message;");
query.get();
// => { message: "Hello world" }
```

The API is synchronous and fast. Credit to better-sqlite3 and its contributors for inspiring the API of `bun:sqlite`.

Features include:

* Transactions
* Parameters (named & positional)
* Prepared statements
* Datatype conversions (`BLOB` becomes `Uint8Array`)
* Map query results to classes without an ORM - `query.as(MyClass)`
* The fastest performance of any SQLite driver for JavaScript
* `bigint` support
* Multi-query statements (e.g. `SELECT 1; SELECT 2;`) in a single call to database.run(query)

---

## Database

To open or create a SQLite3 database:

```ts
import { Database } from "bun:sqlite";

const db = new Database("mydb.sqlite");
```

To open an in-memory database:

```ts
import { Database } from "bun:sqlite";

const db = new Database(":memory:");
const db = new Database();
const db = new Database("");
```

To open in `readonly` mode:

```ts
import { Database } from "bun:sqlite";
const db = new Database("mydb.sqlite", { readonly: true });
```

To create the database if the file doesn't exist:

```ts
import { Database } from "bun:sqlite";
const db = new Database("mydb.sqlite", { create: true });
```

### Strict mode

By default, `bun:sqlite` requires binding parameters to include the `$`, `:`, or `@` prefix, and does not throw an error if a parameter is missing.

To instead throw an error when a parameter is missing and allow binding without a prefix, set `strict: true`:

```ts
import { Database } from "bun:sqlite";

const strict = new Database(":memory:", { strict: true });

// throws error because of the typo:
const query = strict.query("SELECT $message;").all({ messag: "Hello world" });

const notStrict = new Database(":memory:");
// does not throw error:
notStrict.query("SELECT $message;").all({ messag: "Hello world" });
```

### Load via ES module import

```ts
import db from "./mydb.sqlite" with { type: "sqlite" };

console.log(db.query("select * from users LIMIT 1").get());
```

### `.close(throwOnError: boolean = false)`

```ts
const db = new Database();
db.close(false); // close, allow existing queries to finish

const db = new Database();
db.close(true); // close, throw if pending queries
```

> `close(false)` is called automatically when the database is garbage collected. It is safe to call multiple times but has no effect after the first.

### `using` statement

```ts
import { Database } from "bun:sqlite";

{
  using db = new Database("mydb.sqlite");
  using query = db.query("select 'Hello world' as message;");
  console.log(query.get());
}
// => { message: "Hello world" }
```

### `.serialize()`

```ts
const olddb = new Database("mydb.sqlite");
const contents = olddb.serialize(); // => Uint8Array
const newdb = Database.deserialize(contents);
```

### `.query()`

Use the `db.query()` method to prepare a SQL query. The result is a `Statement` instance that will be cached on the `Database` instance.

```ts
const query = db.query(`select "Hello world" as message`);
```

> **What does "cached" mean?** The caching refers to the **compiled prepared statement** (the SQL bytecode), not the query results. When you call `db.query()` with the same SQL string multiple times, Bun returns the same cached `Statement` object instead of recompiling the SQL.

Use `.prepare()` instead of `.query()` when you want a fresh `Statement` instance that isn't cached:

```ts
const query = db.prepare("SELECT * FROM foo WHERE bar = ?");
```

---

## WAL mode

SQLite supports write-ahead log mode (WAL) which dramatically improves performance, especially in situations with many concurrent readers and a single writer.

```ts
db.run("PRAGMA journal_mode = WAL;");
```

### WAL sidecar file cleanup

To ensure sidecar files are cleaned up on all platforms:

```ts
import { Database, constants } from "bun:sqlite";

const db = new Database("mydb.sqlite");
db.run("PRAGMA journal_mode = WAL;");

// Disable persistent WAL (needed on macOS)
db.fileControl(constants.SQLITE_FCNTL_PERSIST_WAL, 0);
// Checkpoint and truncate the WAL file
db.run("PRAGMA wal_checkpoint(TRUNCATE);");
db.close();
```

---

## Statements

A `Statement` is a *prepared query*, which means it's been parsed and compiled into an efficient binary form.

```ts
const query = db.query(`select "Hello world" as message`);
```

Queries can contain parameters. These can be numerical (`?1`) or named (`$param` or `:param` or `@param`).

```ts
const query = db.query(`SELECT ?1, ?2;`);
const query = db.query(`SELECT $param1, $param2;`);
```

### Binding values

```ts
const query = db.query(`select $message;`);
query.all({ $message: "Hello world" });

// Positional parameters
const query = db.query(`select ?1;`);
query.all("Hello world");
```

#### `strict: true` lets you bind values without prefixes

```ts
import { Database } from "bun:sqlite";

const db = new Database(":memory:", { strict: true });

const query = db.query(`select $message;`);

// strict: true
query.all({ message: "Hello world" });

// strict: false
// query.all({ $message: "Hello world" });
```

### `.all()`

Run a query and get back the results as an array of objects:

```ts
const query = db.query(`select $message;`);
query.all({ $message: "Hello world" });
// => [{ message: "Hello world" }]
```

### `.get()`

Run a query and get back the first result as an object:

```ts
const query = db.query(`select $message;`);
query.get({ $message: "Hello world" });
// => { $message: "Hello world" }
```

### `.run()`

Run a query and get back an object with execution metadata:

```ts
const query = db.query(`create table foo;`);
query.run();
// => { lastInsertRowid: 0, changes: 0 }
```

### `.as(Class)` - Map query results to a class

```ts
class Movie {
  title: string;
  year: number;

  get isMarvel() {
    return this.title.includes("Marvel");
  }
}

const query = db.query("SELECT title, year FROM movies").as(Movie);
const movies = query.all();
const first = query.get();

console.log(movies[0].isMarvel);
// => true
```

> As a performance optimization, the class constructor is not called, default initializers are not run, and private fields are not accessible.

### `.iterate()` (`@@iterator`)

```ts
const query = db.query("SELECT * FROM foo");
for (const row of query.iterate()) {
  console.log(row);
}

// Or using @@iterator
for (const row of query) {
  console.log(row);
}
```

### `.values()`

Run a query and get back all results as an array of arrays:

```ts
const query = db.query(`select $message;`);
query.values({ $message: "Hello world" });
// => [[ "Iron Man", 2008 ], [ "The Avengers", 2012 ]]
```

### `.finalize()`

Destroy a `Statement` and free any resources associated with it:

```ts
const query = db.query("SELECT title, year FROM movies");
const movies = query.all();
query.finalize();
```

### `.toString()`

Prints the expanded SQL query:

```ts
const query = db.query("SELECT $param;");
console.log(query.toString()); // => "SELECT NULL"
query.run(42);
console.log(query.toString()); // => "SELECT 42"
```

---

## Parameters

```ts
const query = db.query("SELECT * FROM foo WHERE bar = $bar");
const results = query.all({ $bar: "bar" });

// Numbered (positional) parameters
const query = db.query("SELECT ?1, ?2");
const results = query.all("hello", "goodbye");
```

---

## Integers

### `safeIntegers: true`

When `safeIntegers` is `true`, `bun:sqlite` will return integers as `bigint` types:

```ts
import { Database } from "bun:sqlite";

const db = new Database(":memory:", { safeIntegers: true });
const query = db.query(`SELECT ${BigInt(Number.MAX_SAFE_INTEGER) + 102n} as max_int`);
const result = query.get();
console.log(result.max_int);
// => 9007199254741093n
```

### `safeIntegers: false` (default)

When `safeIntegers` is `false`, integers are returned as `number` types and truncate bits beyond 53:

```ts
import { Database } from "bun:sqlite";

const db = new Database(":memory:", { safeIntegers: false });
const query = db.query(`SELECT ${BigInt(Number.MAX_SAFE_INTEGER) + 102n} as max_int`);
const result = query.get();
console.log(result.max_int);
// => 9007199254741092
```

---

## Transactions

```ts
const insertCat = db.prepare("INSERT INTO cats (name) VALUES ($name)");
const insertCats = db.transaction(cats => {
  for (const cat of cats) insertCat.run(cat);
});

const count = insertCats([{ $name: "Keanu" }, { $name: "Salem" }, { $name: "Crookshanks" }]);
console.log(`Inserted ${count} cats`);
```

Nested transactions use savepoints:

```ts
const insertExpense = db.prepare("INSERT INTO expenses (note, dollars) VALUES (?, ?)");
const insert = db.prepare("INSERT INTO cats (name, age) VALUES ($name, $age)");
const insertCats = db.transaction(cats => {
  for (const cat of cats) insert.run(cat);
});

const adopt = db.transaction(cats => {
  insertExpense.run("adoption fees", 20);
  insertCats(cats); // nested transaction
});

adopt([
  { $name: "Joey", $age: 2 },
  { $name: "Sally", $age: 4 },
  { $name: "Junior", $age: 1 },
]);
```

Deferred, immediate, and exclusive versions:

```ts
insertCats(cats); // uses "BEGIN"
insertCats.deferred(cats); // uses "BEGIN DEFERRED"
insertCats.immediate(cats); // uses "BEGIN IMMEDIATE"
insertCats.exclusive(cats); // uses "BEGIN EXCLUSIVE"
```

### `.loadExtension()`

```ts
import { Database } from "bun:sqlite";

const db = new Database();
db.loadExtension("myext");
```

> **MacOS users**: By default, macOS ships with Apple's proprietary build of SQLite, which doesn't support extensions. To use extensions, install a vanilla build of SQLite via Homebrew and call `Database.setCustomSQLite(path)` before creating any `Database` instances.

### `.fileControl(cmd: number, value: any)`

```ts
import { Database, constants } from "bun:sqlite";

const db = new Database();
db.fileControl(constants.SQLITE_FCNTL_PERSIST_WAL, 0);
```

---

## Reference

```ts
class Database {
  constructor(
    filename: string,
    options?:
      | number
      | {
          readonly?: boolean;
          create?: boolean;
          readwrite?: boolean;
          safeIntegers?: boolean;
          strict?: boolean;
        },
  );

  query<ReturnType, ParamsType>(sql: string): Statement<ReturnType, ParamsType>;
  prepare<ReturnType, ParamsType>(sql: string): Statement<ReturnType, ParamsType>;
  run(sql: string, params?: SQLQueryBindings): { lastInsertRowid: number; changes: number };
  exec = this.run;

  transaction(insideTransaction: (...args: any) => void): CallableFunction & {
    deferred: (...args: any) => void;
    immediate: (...args: any) => void;
    exclusive: (...args: any) => void;
  };

  close(throwOnError?: boolean): void;
}

class Statement<ReturnType, ParamsType> {
  all(...params: ParamsType[]): ReturnType[];
  get(...params: ParamsType[]): ReturnType | null;
  run(...params: ParamsType[]): { lastInsertRowid: number; changes: number };
  values(...params: ParamsType[]): unknown[][];

  finalize(): void;
  toString(): string;

  columnNames: string[];
  columnTypes: string[];
  declaredTypes: (string | null)[];
  paramsCount: number;
  native: any;

  as<T>(Class: new (...args: any[]) => T): Statement<T, ParamsType>;
}

type SQLQueryBindings =
  | string
  | bigint
  | TypedArray
  | number
  | boolean
  | null
  | Record<string, string | bigint | TypedArray | number | boolean | null>;
```

### Datatypes

| JavaScript type | SQLite type            |
| --------------- | ---------------------- |
| `string`        | `TEXT`                 |
| `number`        | `INTEGER` or `DECIMAL` |
| `boolean`       | `INTEGER` (1 or 0)     |
| `Uint8Array`    | `BLOB`                 |
| `Buffer`        | `BLOB`                 |
| `bigint`        | `INTEGER`              |
| `null`          | `NULL`                 |
