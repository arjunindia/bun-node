# SQL

> Bun provides native bindings for working with SQL databases through a unified Promise-based API that supports PostgreSQL, MySQL, and SQLite.

The interface is designed to be performant, with tagged template literals for queries and offering features like connection pooling, transactions, and prepared statements.

```ts
import { sql, SQL } from "bun";

// PostgreSQL (default)
const users = await sql`
  SELECT * FROM users
  WHERE active = ${true}
  LIMIT ${10}
`;

// With MySQL
const mysql = new SQL("mysql://user:pass@localhost:3306/mydb");
const mysqlResults = await mysql`
  SELECT * FROM users
  WHERE active = ${true}
`;

// With SQLite
const sqlite = new SQL("sqlite://myapp.db");
const sqliteResults = await sqlite`
  SELECT * FROM users
  WHERE active = ${1}
`;
```

### Features

* Tagged template literals to protect against SQL injection
* Transactions
* Named & positional parameters
* Connection pooling
* `BigInt` support
* SASL Auth support (SCRAM-SHA-256), MD5, and Clear Text
* Connection timeouts
* Returning rows as data objects, arrays of arrays, or Buffer
* Binary protocol support makes it faster
* TLS support (and auth mode)
* Automatic configuration with environment variable

---

## Database Support

`Bun.SQL` provides a unified API for multiple database systems:

### PostgreSQL

PostgreSQL is used when:

* The connection string doesn't match SQLite or MySQL patterns (it's the fallback adapter)
* The connection string explicitly uses `postgres://` or `postgresql://` protocols
* No connection string is provided and environment variables point to PostgreSQL

```ts
import { sql } from "bun";
await sql`SELECT ...`;

import { SQL } from "bun";
const pg = new SQL("postgres://user:pass@localhost:5432/mydb");
await pg`SELECT ...`;
```

### MySQL

MySQL support is built into Bun.SQL, providing the same tagged template literal interface with full compatibility for MySQL 5.7+ and MySQL 8.0+:

```ts
import { SQL } from "bun";

// MySQL connection
const mysql = new SQL("mysql://user:password@localhost:3306/database");
const mysql2 = new SQL("mysql2://user:password@localhost:3306/database");

// Using options object
const mysql3 = new SQL({
  adapter: "mysql",
  hostname: "localhost",
  port: 3306,
  database: "myapp",
  username: "dbuser",
  password: "secretpass",
});

// Works with parameters - automatically uses prepared statements
const users = await mysql`SELECT * FROM users WHERE id = ${userId}`;

// Transactions work the same as PostgreSQL
await mysql.begin(async tx => {
  await tx`INSERT INTO users (name) VALUES (${"Alice"})`;
  await tx`UPDATE accounts SET balance = balance - 100 WHERE user_id = ${userId}`;
});

// Bulk inserts
const newUsers = [
  { name: "Alice", email: "alice@example.com" },
  { name: "Bob", email: "bob@example.com" },
];
await mysql`INSERT INTO users ${mysql(newUsers)}`;
```

MySQL Connection String Formats:

```ts
new SQL("mysql://user:pass@localhost:3306/database");
new SQL("mysql://user:pass@localhost/database"); // Default port 3306
new SQL("mysql2://user:pass@localhost:3306/database");
new SQL("mysql://user:pass@localhost/db?ssl=true");
new SQL("mysql://user:pass@/database?socket=/var/run/mysqld/mysqld.sock");
```

MySQL-Specific Features:

* **Prepared statements**: Automatically created for parameterized queries with statement caching
* **Binary protocol**: For better performance with prepared statements and accurate type handling
* **Multiple result sets**: Support for stored procedures returning multiple result sets
* **Authentication plugins**: Support for mysql_native_password, caching_sha2_password (MySQL 8.0 default), and sha256_password
* **SSL/TLS connections**: Configurable SSL modes similar to PostgreSQL
* **Connection attributes**: Client information sent to server for monitoring
* **Query pipelining**: Execute multiple prepared statements without waiting for responses

### SQLite

SQLite support is built into Bun.SQL, providing the same tagged template literal interface:

```ts
import { SQL } from "bun";

// In-memory database
const memory = new SQL(":memory:");
const memory2 = new SQL("sqlite://:memory:");

// File-based database
const sql1 = new SQL("sqlite://myapp.db");

// Using options object
const sql2 = new SQL({
  adapter: "sqlite",
  filename: "./data/app.db",
});

// For simple filenames, specify adapter explicitly
const sql3 = new SQL("myapp.db", { adapter: "sqlite" });
```

SQLite Connection String Formats:

```ts
new SQL("sqlite://path/to/database.db");
new SQL("sqlite:path/to/database.db");
new SQL("file://path/to/database.db");
new SQL("file:path/to/database.db");
new SQL(":memory:");
new SQL("sqlite://:memory:");
new SQL("file://:memory:");
new SQL("sqlite://./local.db");
new SQL("sqlite://../parent/db.db");
new SQL("sqlite:///absolute/path.db");
new SQL("sqlite://data.db?mode=ro"); // Read-only mode
new SQL("sqlite://data.db?mode=rw"); // Read-write mode (no create)
new SQL("sqlite://data.db?mode=rwc"); // Read-write-create mode (default)
```

> **Note:** Simple filenames without a protocol (like `"myapp.db"`) require explicitly specifying `{ adapter: "sqlite" }` to avoid ambiguity with PostgreSQL.

SQLite-Specific Options:

```ts
const sql = new SQL({
  adapter: "sqlite",
  filename: "app.db",
  readonly: false,
  create: true,
  readwrite: true,
  strict: true,
  safeIntegers: false,
});
```

---

## Inserting data

You can pass JavaScript values directly to the SQL template literal and escaping will be handled for you.

```ts
import { sql } from "bun";

const [user] = await sql`
  INSERT INTO users (name, email)
  VALUES (${name}, ${email})
  RETURNING *
`;

// Using object helper for cleaner syntax
const userData = {
  name: "Alice",
  email: "alice@example.com",
};

const [newUser] = await sql`
  INSERT INTO users ${sql(userData)}
  RETURNING *
`;
```

### Bulk Insert

```ts
const users = [
  { name: "Alice", email: "alice@example.com" },
  { name: "Bob", email: "bob@example.com" },
  { name: "Charlie", email: "charlie@example.com" },
];

await sql`INSERT INTO users ${sql(users)}`;
```

### Picking columns to insert

```ts
const user = {
  name: "Alice",
  email: "alice@example.com",
  age: 25,
};

await sql`INSERT INTO users ${sql(user, "name", "email")}`;
// Only inserts name and email columns, ignoring other fields
```

---

## Query Results

### `sql``.values()` format

Returns rows as arrays of values rather than objects:

```ts
const rows = await sql`SELECT * FROM users`.values();
// [["Alice", "alice@example.com"], ["Bob", "bob@example.com"]]
```

### `sql``.raw()` format

Returns rows as arrays of `Buffer` objects:

```ts
const rows = await sql`SELECT * FROM users`.raw();
// [[Buffer, Buffer], [Buffer, Buffer]]
```

---

## SQL Fragments

### Dynamic Table Names

```ts
await sql`SELECT * FROM ${sql("users")}`;
await sql`SELECT * FROM ${sql("public.users")}`;
```

### Conditional Queries

```ts
const filterAge = true;
const minAge = 21;
const ageFilter = sql`AND age > ${minAge}`;
await sql`
  SELECT * FROM users
  WHERE active = ${true}
  ${filterAge ? ageFilter : sql``}
`;
```

### Dynamic columns in updates

```ts
await sql`UPDATE users SET ${sql(user, "name", "email")} WHERE id = ${user.id}`;
await sql`UPDATE users SET ${sql(user)} WHERE id = ${user.id}`;
```

### Dynamic values and `where in`

```ts
await sql`SELECT * FROM users WHERE id IN ${sql([1, 2, 3])}`;

const users = [
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" },
  { id: 3, name: "Charlie" },
];
await sql`SELECT * FROM users WHERE id IN ${sql(users, "id")}`;
```

### `sql.array` helper

PostgreSQL-only helper to create array literals:

```ts
await sql`INSERT INTO tags (items) VALUES (${sql.array(["red", "blue", "green"])})`;
await sql`SELECT * FROM products WHERE ids = ANY(${sql.array([1, 2, 3])})`;
```

---

## `sql``.simple()`

Run multiple statements in a single query:

```ts
await sql`
  SELECT 1;
  SELECT 2;
`.simple();
```

### Queries in files

```ts
const result = await sql.file("query.sql", [1, 2, 3]);
```

### Unsafe Queries

```ts
// Multiple commands without parameters
const result = await sql.unsafe(`
  SELECT ${userColumns} FROM users;
  SELECT ${accountColumns} FROM accounts;
`);

// Using parameters (only one command is allowed)
const result = await sql.unsafe("SELECT " + dangerous + " FROM users WHERE id = $1", [id]);
```

### Execute and Cancelling Queries

```ts
const query = sql`SELECT * FROM users`.execute();
setTimeout(() => query.cancel(), 100);
await query;
```

---

## Database Environment Variables

### Automatic Database Detection

* URLs starting with `mysql://` or `mysql2://` use MySQL
* URLs matching SQLite patterns (`:memory:`, `sqlite://`, `file://`) use SQLite
* Everything else defaults to PostgreSQL

### MySQL Environment Variables

| Environment Variable     | Default Value | Description                      |
| ------------------------ | ------------- | -------------------------------- |
| `MYSQL_HOST`             | `localhost`   | Database host                    |
| `MYSQL_PORT`             | `3306`        | Database port                    |
| `MYSQL_USER`             | `root`        | Database user                    |
| `MYSQL_PASSWORD`         | (empty)       | Database password                |
| `MYSQL_DATABASE`         | `mysql`       | Database name                    |
| `MYSQL_URL`              | (empty)       | Primary connection URL for MySQL |

### PostgreSQL Environment Variables

| Environment Variable        | Description                                |
| --------------------------- | ------------------------------------------ |
| `POSTGRES_URL`              | Primary connection URL for PostgreSQL      |
| `DATABASE_URL`              | Alternative connection URL (auto-detected) |
| `PGURL`                     | Alternative connection URL                 |
| `PG_URL`                    | Alternative connection URL                 |
| `TLS_POSTGRES_DATABASE_URL` | SSL/TLS-enabled connection URL             |

Individual parameters:

| Environment Variable | Fallback Variables           | Default Value | Description       |
| -------------------- | ---------------------------- | ------------- | ----------------- |
| `PGHOST`             | -                            | `localhost`   | Database host     |
| `PGPORT`             | -                            | `5432`        | Database port     |
| `PGUSERNAME`         | `PGUSER`, `USER`, `USERNAME` | `postgres`    | Database user     |
| `PGPASSWORD`         | -                            | (empty)       | Database password |
| `PGDATABASE`         | -                            | username      | Database name     |

---

## Runtime Preconnection

```bash
bun --sql-preconnect index.js
DATABASE_URL=postgres://user:pass@localhost:5432/db bun --sql-preconnect index.js
```

---

## Connection Options

### MySQL Options

```ts
import { SQL } from "bun";

const sql = new SQL({
  adapter: "mysql",
  hostname: "localhost",
  port: 3306,
  database: "myapp",
  username: "dbuser",
  password: "secretpass",
  max: 20,
  idleTimeout: 30,
  maxLifetime: 0,
  connectionTimeout: 30,
  ssl: "prefer",
  onconnect: client => {},
  onclose: (client, err) => {},
});
```

### PostgreSQL Options

```ts
import { SQL } from "bun";

const sql = new SQL({
  url: "postgres://user:pass@localhost:5432/dbname",
  hostname: "localhost",
  port: 5432,
  database: "myapp",
  username: "dbuser",
  password: "secretpass",
  max: 20,
  idleTimeout: 30,
  maxLifetime: 0,
  connectionTimeout: 30,
  tls: true,
  onconnect: client => {},
  onclose: client => {},
});
```

### SQLite Options

```ts
import { SQL } from "bun";

const sql = new SQL({
  adapter: "sqlite",
  filename: "./data/app.db",
  readonly: false,
  create: true,
  readwrite: true,
  strict: true,
  safeIntegers: false,
  onconnect: client => {},
  onclose: client => {},
});
```

---

## Dynamic passwords

```ts
import { SQL } from "bun";

const sql = new SQL(url, {
  password: async () => await signer.getAuthToken(),
});
```

---

## Transactions

### Basic Transactions

```ts
await sql.begin(async tx => {
  await tx`INSERT INTO users (name) VALUES (${"Alice"})`;
  await tx`UPDATE accounts SET balance = balance - 100 WHERE user_id = 1`;
});
```

Pipelined transactions:

```ts
await sql.begin(async tx => {
  return [
    tx`INSERT INTO users (name) VALUES (${"Alice"})`,
    tx`UPDATE accounts SET balance = balance - 100 WHERE user_id = 1`,
  ];
});
```

### Savepoints

```ts
await sql.begin(async tx => {
  await tx`INSERT INTO users (name) VALUES (${"Alice"})`;

  await tx.savepoint(async sp => {
    await sp`UPDATE users SET status = 'active'`;
    if (someCondition) {
      throw new Error("Rollback to savepoint");
    }
  });

  await tx`INSERT INTO audit_log (action) VALUES ('user_created')`;
});
```

### Distributed Transactions

```ts
await sql.beginDistributed("tx1", async tx => {
  await tx`INSERT INTO users (name) VALUES (${"Alice"})`;
});

await sql.commitDistributed("tx1");
// or
await sql.rollbackDistributed("tx1");
```

---

## Authentication

Bun supports SCRAM-SHA-256 (SASL), MD5, and Clear Text authentication.

### SSL Modes

```ts
const sql = new SQL({
  hostname: "localhost",
  username: "user",
  password: "password",
  ssl: "disable", // | "prefer" | "require" | "verify-ca" | "verify-full"
});
```

| SSL Mode      | Description                                          |
| ------------- | ---------------------------------------------------- |
| `disable`     | No SSL/TLS used.                                     |
| `prefer`      | Tries SSL first, falls back to non-SSL. Default.     |
| `require`     | Requires SSL without certificate verification.       |
| `verify-ca`   | Verifies server certificate is signed by trusted CA. |
| `verify-full` | Verifies certificate and hostname match.             |

---

## Connection Pooling

```ts
const sql = new SQL({
  max: 20,
  idleTimeout: 30,
  maxLifetime: 3600,
  connectionTimeout: 10,
});
```

No connection will be made until a query is made.

```ts
const sql = Bun.SQL(); // no connections created

await sql`...`; // pool is started, first available connection is used
await sql`...`; // previous connection is reused

await Promise.all([
  sql`INSERT INTO users ${sql({ name: "Alice" })}`,
  sql`UPDATE users SET name = ${user.name} WHERE id = ${user.id}`,
]);

await sql.close(); // await all queries to finish and close all connections
await sql.close({ timeout: 5 }); // wait 5 seconds and close
await sql.close({ timeout: 0 }); // close immediately
```

---

## Reserved Connections

```ts
const reserved = await sql.reserve();

try {
  await reserved`INSERT INTO users (name) VALUES (${"Alice"})`;
} finally {
  reserved.release();
}

// Or using Symbol.dispose
{
  using reserved = await sql.reserve();
  await reserved`SELECT 1`;
}
```

---

## Prepared Statements

By default, Bun's SQL client automatically creates named prepared statements for static queries.

```ts
const sql = new SQL({
  prepare: false, // Disable persisting named prepared statements
});
```

When `prepare: false` is set:

* Parameter binding is still safe against SQL injection
* Each query is parsed and planned from scratch by the server
* Queries will not be pipelined

---

## Error Handling

```ts
import { SQL } from "bun";

try {
  await sql`SELECT * FROM users`;
} catch (error) {
  if (error instanceof SQL.PostgresError) {
    console.log(error.code);
    console.log(error.detail);
    console.log(error.hint);
  } else if (error instanceof SQL.SQLiteError) {
    console.log(error.code);
    console.log(error.errno);
    console.log(error.byteOffset);
  } else if (error instanceof SQL.SQLError) {
    console.log(error.message);
  }
}
```

### PostgreSQL Connection Errors

| Error Code                           | Description                                |
| ------------------------------------ | ------------------------------------------ |
| `ERR_POSTGRES_CONNECTION_CLOSED`     | Connection was terminated or never established |
| `ERR_POSTGRES_CONNECTION_TIMEOUT`    | Failed to establish connection within timeout |
| `ERR_POSTGRES_IDLE_TIMEOUT`          | Connection closed due to inactivity        |
| `ERR_POSTGRES_LIFETIME_TIMEOUT`      | Connection exceeded maximum lifetime       |
| `ERR_POSTGRES_TLS_NOT_AVAILABLE`     | SSL/TLS connection not available           |
| `ERR_POSTGRES_TLS_UPGRADE_FAILED`    | Failed to upgrade connection to SSL/TLS    |

### SQLite Error Codes

| Error Code          | errno | Description                      |
| ------------------- | ----- | -------------------------------- |
| `SQLITE_CONSTRAINT` | 19    | Constraint violation             |
| `SQLITE_BUSY`       | 5     | Database is locked               |
| `SQLITE_READONLY`   | 8     | Attempt to write to readonly db  |
| `SQLITE_IOERR`      | 10    | Disk I/O error                   |
| `SQLITE_CORRUPT`    | 11    | Database disk image is malformed |

---

## Numbers and BigInt

```ts
import { sql } from "bun";

const [{ x, y }] = await sql`SELECT 9223372036854777 as x, 12345 as y`;

console.log(typeof x, x); // "string" "9223372036854777"
console.log(typeof y, y); // "number" 12345
```

### BigInt Instead of Strings

```ts
const sql = new SQL({
  bigint: true,
});

const [{ x }] = await sql`SELECT 9223372036854777 as x`;
console.log(typeof x, x); // "bigint" 9223372036854777n
```

---

## MySQL Type Handling

| MySQL Type                              | JavaScript Type          | Notes                                    |
| --------------------------------------- | ------------------------ | ---------------------------------------- |
| INT, TINYINT, MEDIUMINT                 | number                   | Within safe integer range                |
| BIGINT                                  | string, number or BigInt | Based on `bigint` option                 |
| DECIMAL, NUMERIC                        | string                   | To preserve precision                    |
| FLOAT, DOUBLE                           | number                   |                                          |
| DATE                                    | Date                     |                                          |
| DATETIME, TIMESTAMP                     | Date                     | With timezone handling                   |
| TIME                                    | number                   | Total of microseconds                    |
| CHAR, VARCHAR, TEXT                     | string                   |                                          |
| BLOB                                    | string                   | BLOB types are alias for TEXT types      |
| JSON                                    | object/array             | Automatically parsed                     |
| BIT(1)                                  | boolean                  |                                          |

---

## Why not just use an existing library?

npm packages like postgres.js, pg, and node-postgres can be used in Bun too. Two reasons why:

1. It's simpler for developers to have a database driver built into Bun.
2. Bun leverages JavaScriptCore engine internals to make it faster to create objects.
