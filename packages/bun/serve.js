import http from "node:http";
import https from "node:https";
import { randomUUIDv7 } from "./index.js";

// --- Router ---

class Router {
  #routes;
  #compiled;

  constructor(routes = {}) {
    this.#routes = routes;
    this.#compiled = this.#compile(Object.entries(routes));
  }

  #compile(entries) {
    const compiled = [];
    for (const [pattern, handler] of entries) {
      const keys = [];
      let regex = pattern
        .replace(/:[a-zA-Z_]\w*/g, (match, offset) => {
          keys.push(pattern.slice(offset + 1).split(/[/?#]/)[0]);
          return "([^/]+)";
        })
        .replace(/\*/g, () => {
          keys.push("*");
          return "(.*)";
        });
      if (!pattern.includes("*")) {
        regex = `^${regex}$`;
      } else {
        regex = `^${regex}`;
      }
      compiled.push({
        pattern,
        regex: new RegExp(regex),
        keys,
        handler,
        isStatic: !pattern.includes(":") && !pattern.includes("*"),
      });
    }
    compiled.sort((a, b) => {
      if (a.isStatic && !b.isStatic) return -1;
      if (!a.isStatic && b.isStatic) return 1;
      if (a.pattern.includes("*") && !b.pattern.includes("*")) return 1;
      if (!a.pattern.includes("*") && b.pattern.includes("*")) return -1;
      return b.pattern.split("/").length - a.pattern.split("/").length;
    });
    return compiled;
  }

  match(pathname, method) {
    for (const route of this.#compiled) {
      const match = route.regex.exec(pathname);
      if (match) {
        const params = {};
        for (let i = 0; i < route.keys.length; i++) {
          params[route.keys[i]] = match[i + 1];
        }

        let handler = route.handler;

        if (handler instanceof Response) {
          return { handler: () => handler.clone(), params };
        }

        if (typeof handler === "object" && handler !== null && !Array.isArray(handler)) {
          const methodHandler = handler[method] || handler[method.toUpperCase()];
          if (methodHandler) {
            if (methodHandler instanceof Response) {
              return { handler: () => methodHandler.clone(), params };
            }
            return { handler: methodHandler, params };
          }
          return null;
        }

        return { handler, params };
      }
    }
    return null;
  }

  reload(routes = {}) {
    this.#routes = routes;
    this.#compiled = this.#compile(Object.entries(routes));
  }
}

// --- Request Conversion ---

async function nodeReqToWebReq(nodeReq, params) {
  const host = nodeReq.headers.host || "localhost";
  const protocol = nodeReq.socket.encrypted ? "https" : "http";
  const url = `${protocol}://${host}${nodeReq.url}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(nodeReq.headers)) {
    if (value !== undefined) {
      headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }
  }

  const init = {
    method: nodeReq.method,
    headers,
  };

  if (nodeReq.method !== "GET" && nodeReq.method !== "HEAD") {
    init.body = nodeReq;
    init.duplex = "half";
  }

  const webReq = new Request(url, init);
  webReq.params = params || {};
  webReq._socket = nodeReq.socket;

  return webReq;
}

// --- Response Writing ---

async function writeWebRes(webRes, nodeRes) {
  const status = webRes.status;
  const headers = {};

  webRes.headers.forEach((value, key) => {
    headers[key] = value;
  });

  nodeRes.writeHead(status, headers);

  if (webRes.body) {
    if (typeof webRes.body.getReader === "function") {
      const reader = webRes.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          nodeRes.write(value);
        }
      } finally {
        reader.releaseLock();
      }
    } else if (Buffer.isBuffer(webRes.body)) {
      nodeRes.write(webRes.body);
    }
  }

  nodeRes.end();
}

// --- Server ---

class Server {
  #httpServer;
  #options;
  #router;
  #fetch;
  #errorHandler;
  #pendingRequests;
  #id;
  #listening;
  #listenPromise;

  constructor(options = {}) {
    this.#options = options;
    this.#id = randomUUIDv7();
    this.#pendingRequests = 0;
    this.#listening = false;
    this.#fetch = options.fetch || (() => new Response("Not Found", { status: 404 }));
    this.#errorHandler = options.error || null;
    this.#router = new Router(options.routes || {});

    this.#httpServer = http.createServer((nodeReq, nodeRes) => {
      this.#handleReq(nodeReq, nodeRes);
    });

    if (options.idleTimeout !== undefined) {
      this.#httpServer.timeout = options.idleTimeout * 1000;
    }

    const port = this.#resolvePort(options);
    const hostname = options.hostname || "0.0.0.0";

    this.ready = new Promise((resolve, reject) => {
      this.#httpServer.on("listening", () => {
        this.#listening = true;
        resolve(this);
      });
      this.#httpServer.on("error", reject);

      if (options.unix) {
        this.#httpServer.listen(options.unix);
      } else {
        this.#httpServer.listen(port, hostname);
      }
    });
  }

  #resolvePort(options) {
    if (options.port !== undefined) return options.port;
    if (process.env.BUN_PORT) return Number(process.env.BUN_PORT);
    if (process.env.PORT) return Number(process.env.PORT);
    if (process.env.NODE_PORT) return Number(process.env.NODE_PORT);
    return 3000;
  }

  async #handleReq(nodeReq, nodeRes) {
    this.#pendingRequests++;
    try {
      const pathname = new URL(nodeReq.url, "http://localhost").pathname;
      const method = nodeReq.method;

      const match = this.#router.match(pathname, method);

      let response;
      if (match) {
        const webReq = await nodeReqToWebReq(nodeReq, match.params);
        try {
          response = await match.handler(webReq, this);
        } catch (err) {
          response = this.#handleErr(err);
        }
      } else {
        const webReq = await nodeReqToWebReq(nodeReq, {});
        try {
          response = await this.#fetch(webReq, this);
        } catch (err) {
          response = this.#handleErr(err);
        }
      }

      if (!(response instanceof Response)) {
        response = new Response(String(response));
      }

      await writeWebRes(response, nodeRes);
    } catch (err) {
      try {
        nodeRes.writeHead(500, { "content-type": "text/plain" });
        nodeRes.end("Internal Server Error");
      } catch {}
    } finally {
      this.#pendingRequests--;
    }
  }

  #handleErr(err) {
    if (this.#errorHandler) {
      try {
        return this.#errorHandler(err);
      } catch {
        return new Response("Internal Server Error", { status: 500 });
      }
    }
    console.error("Unhandled error in Bun.serve:", err);
    return new Response("Internal Server Error", { status: 500 });
  }

  // --- Public API ---

  get port() {
    const addr = this.#httpServer.address();
    if (!addr) return 0;
    if (typeof addr === "string") return 0;
    return addr.port ?? 0;
  }

  get hostname() {
    return this.#options.hostname || "0.0.0.0";
  }

  get url() {
    const host = this.hostname === "0.0.0.0" || this.hostname === "::"
      ? "127.0.0.1"
      : this.hostname;
    return new URL(`http://${host}:${this.port}`);
  }

  get development() {
    return this.#options.development ?? true;
  }

  get id() {
    return this.#id;
  }

  get pendingRequests() {
    return this.#pendingRequests;
  }

  get pendingWebSockets() {
    return 0;
  }

  async stop(forceClose = false) {
    if (forceClose) {
      this.#httpServer.closeAllConnections();
    }
    return new Promise((resolve, reject) => {
      this.#httpServer.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  reload(options = {}) {
    if (options.fetch) this.#fetch = options.fetch;
    if (options.error) this.#errorHandler = options.error;
    if (options.routes) this.#router.reload(options.routes);
  }

  timeout(request, seconds) {
    request._timeout = seconds;
  }

  requestIP(request) {
    if (request._socket) {
      return {
        address: request._socket.remoteAddress,
        family: request._socket.remoteFamily || "IPv4",
        port: request._socket.remotePort,
      };
    }
    return null;
  }

  ref() {
    this.#httpServer.ref();
  }

  unref() {
    this.#httpServer.unref();
  }

  publish(topic, data) {
    return 0;
  }

  subscriberCount(topic) {
    return 0;
  }

  fetch(request) {
    return this.#fetch(request, this);
  }
}

// --- serve() function ---

function serve(options = {}) {
  return new Server(options);
}

export { serve, Server };
export default { serve, Server };
