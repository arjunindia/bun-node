class Cookie {
  #name;
  #value;
  #domain;
  #path;
  #expires;
  #secure;
  #sameSite;
  #partitioned;
  #maxAge;
  #httpOnly;

  constructor(nameOrOptions, value, options) {
    if (typeof nameOrOptions === "string" && value !== undefined) {
      this.#name = nameOrOptions;
      this.#value = value;
      const opts = options || {};
      this.#domain = opts.domain ?? null;
      this.#path = opts.path ?? "/";
      this.#expires = opts.expires;
      this.#secure = opts.secure ?? false;
      this.#sameSite = opts.sameSite ?? "lax";
      this.#partitioned = opts.partitioned ?? false;
      this.#maxAge = opts.maxAge;
      this.#httpOnly = opts.httpOnly ?? false;
    } else if (typeof nameOrOptions === "string" && value === undefined) {
      // Parse Set-Cookie string
      const parsed = Cookie.#parseString(nameOrOptions);
      this.#name = parsed.name;
      this.#value = parsed.value;
      this.#domain = parsed.domain;
      this.#path = parsed.path;
      this.#expires = parsed.expires;
      this.#secure = parsed.secure;
      this.#sameSite = parsed.sameSite;
      this.#partitioned = parsed.partitioned;
      this.#maxAge = parsed.maxAge;
      this.#httpOnly = parsed.httpOnly;
    } else if (typeof nameOrOptions === "object") {
      const opts = nameOrOptions;
      this.#name = opts.name ?? "";
      this.#value = opts.value ?? "";
      this.#domain = opts.domain ?? null;
      this.#path = opts.path ?? "/";
      this.#expires = opts.expires;
      this.#secure = opts.secure ?? false;
      this.#sameSite = opts.sameSite ?? "lax";
      this.#partitioned = opts.partitioned ?? false;
      this.#maxAge = opts.maxAge;
      this.#httpOnly = opts.httpOnly ?? false;
    }
  }

  static #parseString(str) {
    const parts = str.split(";").map((s) => s.trim());
    const [nameValue, ...attrs] = parts;
    const eqIdx = nameValue.indexOf("=");
    const name = eqIdx === -1 ? nameValue : nameValue.slice(0, eqIdx);
    const value = eqIdx === -1 ? "" : nameValue.slice(eqIdx + 1);

    const result = { name, value, domain: null, path: "/", secure: false, sameSite: "lax", partitioned: false, httpOnly: false };

    for (const attr of attrs) {
      const [key, val] = attr.split("=").map((s) => s.trim());
      const k = key.toLowerCase();
      if (k === "domain") result.domain = val;
      else if (k === "path") result.path = val;
      else if (k === "expires") result.expires = new Date(val).getTime();
      else if (k === "max-age") result.maxAge = parseInt(val, 10);
      else if (k === "secure") result.secure = true;
      else if (k === "httponly") result.httpOnly = true;
      else if (k === "samesite") result.sameSite = val.toLowerCase();
      else if (k === "partitioned") result.partitioned = true;
    }

    return result;
  }

  get name() { return this.#name; }
  get value() { return this.#value; }
  set value(v) { this.#value = v; }
  get domain() { return this.#domain; }
  set domain(v) { this.#domain = v; }
  get path() { return this.#path; }
  set path(v) { this.#path = v; }
  get expires() { return this.#expires; }
  set expires(v) { this.#expires = v; }
  get secure() { return this.#secure; }
  set secure(v) { this.#secure = v; }
  get sameSite() { return this.#sameSite; }
  set sameSite(v) { this.#sameSite = v; }
  get partitioned() { return this.#partitioned; }
  set partitioned(v) { this.#partitioned = v; }
  get maxAge() { return this.#maxAge; }
  set maxAge(v) { this.#maxAge = v; }
  get httpOnly() { return this.#httpOnly; }
  set httpOnly(v) { this.#httpOnly = v; }

  isExpired() {
    if (this.#maxAge !== undefined && this.#maxAge <= 0) return true;
    if (this.#expires !== undefined) return Date.now() > this.#expires;
    return false;
  }

  serialize() {
    let str = `${this.#name}=${this.#value}`;
    if (this.#domain) str += `; Domain=${this.#domain}`;
    if (this.#path) str += `; Path=${this.#path}`;
    if (this.#expires !== undefined) str += `; Expires=${new Date(this.#expires).toUTCString()}`;
    if (this.#maxAge !== undefined) str += `; Max-Age=${this.#maxAge}`;
    if (this.#secure) str += "; Secure";
    if (this.#httpOnly) str += "; HttpOnly";
    if (this.#sameSite) str += `; SameSite=${this.#sameSite}`;
    if (this.#partitioned) str += "; Partitioned";
    return str;
  }

  toString() { return this.serialize(); }

  toJSON() {
    return {
      name: this.#name,
      value: this.#value,
      domain: this.#domain,
      path: this.#path,
      expires: this.#expires,
      secure: this.#secure,
      sameSite: this.#sameSite,
      partitioned: this.#partitioned,
      maxAge: this.#maxAge,
      httpOnly: this.#httpOnly,
    };
  }

  static parse(str) {
    return new Cookie(str);
  }

  static from(name, value, options) {
    return new Cookie(name, value, options);
  }
}

class CookieMap {
  #cookies;
  #setCookies;

  constructor(input) {
    this.#cookies = new Map();
    this.#setCookies = [];

    if (typeof input === "string") {
      const pairs = input.split(";").map((s) => s.trim()).filter(Boolean);
      for (const pair of pairs) {
        const eqIdx = pair.indexOf("=");
        if (eqIdx !== -1) {
          this.#cookies.set(pair.slice(0, eqIdx).trim(), pair.slice(eqIdx + 1).trim());
        }
      }
    } else if (Array.isArray(input)) {
      for (const [k, v] of input) {
        this.#cookies.set(k, v);
      }
    } else if (typeof input === "object" && input !== null) {
      for (const [k, v] of Object.entries(input)) {
        this.#cookies.set(k, v);
      }
    }
  }

  get(name) {
    return this.#cookies.get(name) ?? null;
  }

  has(name) {
    return this.#cookies.has(name);
  }

  set(nameOrOptions, value) {
    if (typeof nameOrOptions === "string") {
      this.#cookies.set(nameOrOptions, value);
      this.#setCookies.push(new Cookie(nameOrOptions, value));
    } else if (nameOrOptions instanceof Cookie) {
      this.#cookies.set(nameOrOptions.name, nameOrOptions.value);
      this.#setCookies.push(nameOrOptions);
    } else {
      const opts = nameOrOptions;
      this.#cookies.set(opts.name, opts.value);
      this.#setCookies.push(new Cookie(opts.name, opts.value, opts));
    }
  }

  delete(nameOrOptions) {
    if (typeof nameOrOptions === "string") {
      this.#cookies.delete(nameOrOptions);
      this.#setCookies.push(new Cookie(nameOrOptions, "", { expires: new Date(0) }));
    } else {
      const opts = nameOrOptions;
      this.#cookies.delete(opts.name);
      this.#setCookies.push(new Cookie(opts.name, "", { expires: new Date(0), domain: opts.domain, path: opts.path }));
    }
  }

  get size() {
    return this.#cookies.size;
  }

  toJSON() {
    return Object.fromEntries(this.#cookies);
  }

  toSetCookieHeaders() {
    return this.#setCookies.map((c) => c.serialize());
  }

  entries() { return this.#cookies.entries(); }
  keys() { return this.#cookies.keys(); }
  values() { return this.#cookies.values(); }
  forEach(fn) { this.#cookies.forEach(fn); }
  [Symbol.iterator]() { return this.#cookies[Symbol.iterator](); }
}

export { Cookie, CookieMap };
export default { Cookie, CookieMap };
