import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { serve, Server } from "../serve.js";

let server;

afterEach(async () => {
  if (server) {
    await server.stop(true);
    server = null;
  }
});

// --- Basic serve ---

describe("Bun.serve basics", () => {
  it("creates a server with fetch handler", async () => {
    server = serve({
      port: 0,
      fetch(req) {
        return new Response("Hello!");
      },
    });
    await server.ready;
    expect(server).toBeDefined();
  });

  it("returns a Server instance", async () => {
    server = serve({
      port: 0,
      fetch(req) {
        return new Response("Hello!");
      },
    });
    await server.ready;
    expect(server).toBeInstanceOf(Server);
  });

  it("server.url returns a URL", async () => {
    server = serve({
      port: 0,
      fetch(req) {
        return new Response("Hello!");
      },
    });
    await server.ready;
    expect(server.url).toBeInstanceOf(URL);
    expect(server.url.protocol).toBe("http:");
  });

  it("server.port returns the assigned port", async () => {
    server = serve({
      port: 0,
      fetch(req) {
        return new Response("Hello!");
      },
    });
    await server.ready;
    expect(typeof server.port).toBe("number");
    expect(server.port).toBeGreaterThan(0);
  });

  it("server.hostname returns hostname", async () => {
    server = serve({
      port: 0,
      hostname: "127.0.0.1",
      fetch(req) {
        return new Response("Hello!");
      },
    });
    await server.ready;
    expect(server.hostname).toBe("127.0.0.1");
  });

  it("handles requests", async () => {
    server = serve({
      port: 0,
      fetch(req) {
        return new Response("Hello from buniso!");
      },
    });
    await server.ready;
    const res = await fetch(server.url);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("Hello from buniso!");
  });

  it("handles async fetch handlers", async () => {
    server = serve({
      port: 0,
      async fetch(req) {
        return new Response("async response");
      },
    });
    await server.ready;
    const res = await fetch(server.url);
    expect(await res.text()).toBe("async response");
  });
});

// --- Routes ---

describe("Bun.serve routes", () => {
  it("matches static routes", async () => {
    server = serve({
      port: 0,
      routes: {
        "/api/status": new Response("OK"),
      },
      fetch(req) {
        return new Response("Not Found", { status: 404 });
      },
    });
    await server.ready;
    const res = await fetch(new URL("/api/status", server.url));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  });

  it("matches dynamic routes with params", async () => {
    server = serve({
      port: 0,
      routes: {
        "/users/:id": (req) => {
          return new Response(`User ${req.params.id}`);
        },
      },
      fetch(req) {
        return new Response("Not Found", { status: 404 });
      },
    });
    await server.ready;
    const res = await fetch(new URL("/users/42", server.url));
    expect(await res.text()).toBe("User 42");
  });

  it("matches wildcard routes", async () => {
    server = serve({
      port: 0,
      routes: {
        "/api/*": new Response("API fallback", { status: 404 }),
      },
      fetch(req) {
        return new Response("Not Found", { status: 404 });
      },
    });
    await server.ready;
    const res = await fetch(new URL("/api/anything/here", server.url));
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("API fallback");
  });

  it("matches per-method handlers", async () => {
    server = serve({
      port: 0,
      routes: {
        "/api/posts": {
          GET: () => new Response("List posts"),
          POST: async (req) => {
            const body = await req.json();
            return Response.json({ created: true, ...body });
          },
        },
      },
      fetch(req) {
        return new Response("Not Found", { status: 404 });
      },
    });
    await server.ready;

    const getRes = await fetch(new URL("/api/posts", server.url));
    expect(await getRes.text()).toBe("List posts");

    const postRes = await fetch(new URL("/api/posts", server.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Hello" }),
    });
    const json = await postRes.json();
    expect(json.created).toBe(true);
    expect(json.title).toBe("Hello");
  });

  it("matches static Response objects", async () => {
    server = serve({
      port: 0,
      routes: {
        "/hello": new Response("Hello World"),
      },
      fetch(req) {
        return new Response("Not Found", { status: 404 });
      },
    });
    await server.ready;
    const res = await fetch(new URL("/hello", server.url));
    expect(await res.text()).toBe("Hello World");
  });

  it("handles Response.redirect()", async () => {
    server = serve({
      port: 0,
      routes: {
        "/old": Response.redirect("http://localhost/new", 302),
      },
      fetch(req) {
        return new Response("Not Found", { status: 404 });
      },
    });
    await server.ready;
    const res = await fetch(new URL("/old", server.url), { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/new");
  });

  it("handles Response.json()", async () => {
    server = serve({
      port: 0,
      routes: {
        "/data": Response.json({ message: "hello" }),
      },
      fetch(req) {
        return new Response("Not Found", { status: 404 });
      },
    });
    await server.ready;
    const res = await fetch(new URL("/data", server.url));
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual({ message: "hello" });
  });

  it("falls back to fetch for unmatched routes", async () => {
    server = serve({
      port: 0,
      routes: {
        "/api/status": new Response("OK"),
      },
      fetch(req) {
        return new Response("Fallback", { status: 404 });
      },
    });
    await server.ready;
    const res = await fetch(new URL("/unknown", server.url));
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("Fallback");
  });
});

// --- Server lifecycle ---

describe("Server lifecycle", () => {
  it("server.stop() stops listening", async () => {
    server = serve({
      port: 0,
      fetch(req) {
        return new Response("Hello!");
      },
    });
    await server.ready;
    const url = server.url;
    await server.stop(true);
    server = null;
    await expect(fetch(url)).rejects.toThrow();
  });

  it("server.reload() updates routes", async () => {
    server = serve({
      port: 0,
      routes: {
        "/api/version": Response.json({ version: "1.0.0" }),
      },
      fetch(req) {
        return new Response("Not Found", { status: 404 });
      },
    });
    await server.ready;

    let res = await fetch(new URL("/api/version", server.url));
    expect((await res.json()).version).toBe("1.0.0");

    server.reload({
      routes: {
        "/api/version": Response.json({ version: "2.0.0" }),
      },
      fetch(req) {
        return new Response("Not Found", { status: 404 });
      },
    });

    res = await fetch(new URL("/api/version", server.url));
    expect((await res.json()).version).toBe("2.0.0");
  });
});

// --- Per-request controls ---

describe("Per-request controls", () => {
  it("server.requestIP() returns address info", async () => {
    let ipResult;
    server = serve({
      port: 0,
      fetch(req, srv) {
        ipResult = srv.requestIP(req);
        return new Response("OK");
      },
    });
    await server.ready;
    await fetch(server.url);
    expect(ipResult).toBeDefined();
    expect(ipResult).toHaveProperty("address");
    expect(ipResult).toHaveProperty("family");
    expect(ipResult).toHaveProperty("port");
  });

  it("server.timeout() does not throw", async () => {
    server = serve({
      port: 0,
      fetch(req, srv) {
        srv.timeout(req, 30);
        return new Response("OK");
      },
    });
    await server.ready;
    const res = await fetch(server.url);
    expect(res.status).toBe(200);
  });
});

// --- Server properties ---

describe("Server properties", () => {
  it("server.development defaults to true", async () => {
    server = serve({
      port: 0,
      fetch(req) {
        return new Response("OK");
      },
    });
    await server.ready;
    expect(server.development).toBe(true);
  });

  it("server.id is a string", async () => {
    server = serve({
      port: 0,
      fetch(req) {
        return new Response("OK");
      },
    });
    await server.ready;
    expect(typeof server.id).toBe("string");
  });

  it("server.pendingRequests is a number", async () => {
    server = serve({
      port: 0,
      fetch(req) {
        return new Response("OK");
      },
    });
    await server.ready;
    expect(typeof server.pendingRequests).toBe("number");
  });

  it("server.pendingWebSockets is 0", async () => {
    server = serve({
      port: 0,
      fetch(req) {
        return new Response("OK");
      },
    });
    await server.ready;
    expect(server.pendingWebSockets).toBe(0);
  });

  it("server.ref() and server.unref() do not throw", async () => {
    server = serve({
      port: 0,
      fetch(req) {
        return new Response("OK");
      },
    });
    await server.ready;
    expect(() => server.unref()).not.toThrow();
    expect(() => server.ref()).not.toThrow();
  });
});

// --- Request object ---

describe("Request object", () => {
  it("has correct method", async () => {
    let method;
    server = serve({
      port: 0,
      fetch(req) {
        method = req.method;
        return new Response("OK");
      },
    });
    await server.ready;
    await fetch(server.url);
    expect(method).toBe("GET");
  });

  it("has correct url", async () => {
    let url;
    server = serve({
      port: 0,
      fetch(req) {
        url = req.url;
        return new Response("OK");
      },
    });
    await server.ready;
    await fetch(new URL("/test?foo=bar", server.url));
    expect(url).toContain("/test");
    expect(url).toContain("foo=bar");
  });

  it("has headers", async () => {
    let hasHeader;
    server = serve({
      port: 0,
      fetch(req) {
        hasHeader = req.headers.get("x-custom");
        return new Response("OK");
      },
    });
    await server.ready;
    await fetch(server.url, { headers: { "x-custom": "test-value" } });
    expect(hasHeader).toBe("test-value");
  });

  it("handles POST body", async () => {
    let body;
    server = serve({
      port: 0,
      async fetch(req) {
        body = await req.text();
        return new Response("OK");
      },
    });
    await server.ready;
    await fetch(server.url, { method: "POST", body: "hello body" });
    expect(body).toBe("hello body");
  });
});

// --- Error handling ---

describe("Error handling", () => {
  it("error handler is called on fetch throw", async () => {
    let errorCaught;
    server = serve({
      port: 0,
      fetch(req) {
        throw new Error("test error");
      },
      error(err) {
        errorCaught = err.message;
        return new Response("Internal Error", { status: 500 });
      },
    });
    await server.ready;
    const res = await fetch(server.url);
    expect(res.status).toBe(500);
    expect(await res.text()).toBe("Internal Error");
    expect(errorCaught).toBe("test error");
  });
});
