import { describe, it, expect } from "vitest";
import { semver } from "../semver.js";
import { TOML } from "../toml.js";
import { Glob } from "../glob.js";
import { color } from "../color.js";
import { Cookie, CookieMap } from "../cookies.js";
import { CSRF } from "../csrf.js";
import { markdown } from "../markdown.js";
import { Image } from "../image.js";

// --- semver ---

describe("Bun.semver", () => {
  it("satisfies caret range", () => {
    expect(semver.satisfies("1.0.0", "^1.0.0")).toBe(true);
    expect(semver.satisfies("1.0.0", "^1.0.1")).toBe(false);
  });

  it("satisfies tilde range", () => {
    expect(semver.satisfies("1.0.0", "~1.0.0")).toBe(true);
    expect(semver.satisfies("1.0.0", "~1.0.1")).toBe(false);
  });

  it("satisfies exact version", () => {
    expect(semver.satisfies("1.0.0", "1.0.0")).toBe(true);
    expect(semver.satisfies("1.0.0", "1.0.1")).toBe(false);
  });

  it("satisfies wildcard", () => {
    expect(semver.satisfies("1.0.0", "1.0.x")).toBe(true);
    expect(semver.satisfies("1.0.0", "1.x.x")).toBe(true);
    expect(semver.satisfies("1.0.0", "x.x.x")).toBe(true);
  });

  it("satisfies hyphen range", () => {
    expect(semver.satisfies("1.0.0", "1.0.0 - 2.0.0")).toBe(true);
    expect(semver.satisfies("1.0.0", "1.0.0 - 1.0.1")).toBe(true);
  });

  it("order returns 0 for equal", () => {
    expect(semver.order("1.0.0", "1.0.0")).toBe(0);
  });

  it("order returns -1 when a < b", () => {
    expect(semver.order("1.0.0", "1.0.1")).toBe(-1);
  });

  it("order returns 1 when a > b", () => {
    expect(semver.order("1.0.1", "1.0.0")).toBe(1);
  });

  it("order sorts pre-release tags", () => {
    const unsorted = ["1.0.0", "1.0.1", "1.0.0-alpha", "1.0.0-beta", "1.0.0-rc"];
    const sorted = unsorted.sort(semver.order);
    expect(sorted).toEqual(["1.0.0-alpha", "1.0.0-beta", "1.0.0-rc", "1.0.0", "1.0.1"]);
  });

  it("returns false for invalid version", () => {
    expect(semver.satisfies("not-a-version", "^1.0.0")).toBe(false);
  });
});

// --- TOML ---

describe("Bun.TOML", () => {
  it("parses simple TOML", () => {
    const data = TOML.parse(`
name = "my-app"
version = "1.0.0"
debug = true
`);
    expect(data.name).toBe("my-app");
    expect(data.version).toBe("1.0.0");
    expect(data.debug).toBe(true);
  });

  it("parses nested tables", () => {
    const data = TOML.parse(`
[database]
host = "localhost"
port = 5432
`);
    expect(data.database.host).toBe("localhost");
    expect(data.database.port).toBe(5432);
  });

  it("parses arrays", () => {
    const data = TOML.parse(`
[features]
tags = ["web", "api"]
`);
    expect(data.features.tags).toEqual(["web", "api"]);
  });

  it("throws on invalid TOML", () => {
    expect(() => TOML.parse("invalid = = =")).toThrow();
  });
});

// --- Glob ---

describe("Bun.Glob", () => {
  it("matches simple patterns", () => {
    const glob = new Glob("*.ts");
    expect(glob.match("index.ts")).toBe(true);
    expect(glob.match("index.js")).toBe(false);
  });

  it("matches with character classes", () => {
    const glob = new Glob("ba[rz].ts");
    expect(glob.match("bar.ts")).toBe(true);
    expect(glob.match("baz.ts")).toBe(true);
    expect(glob.match("bat.ts")).toBe(false);
  });

  it("matches alternation", () => {
    const glob = new Glob("{a,b,c}.ts");
    expect(glob.match("a.ts")).toBe(true);
    expect(glob.match("b.ts")).toBe(true);
    expect(glob.match("d.ts")).toBe(false);
  });

  it("scanSync finds files", () => {
    const glob = new Glob("*.json");
    const files = glob.scanSync("D:/htmlcss/buniso/packages/bun");
    expect(files.length).toBeGreaterThan(0);
    expect(files[0]).toMatch(/\.json$/);
  });
});

// --- color ---

describe("Bun.color", () => {
  it("converts named color to hex", () => {
    expect(color("red", "hex")).toBe("#ff0000");
  });

  it("converts hex to hex", () => {
    expect(color("#ff0000", "hex")).toBe("#ff0000");
  });

  it("converts number to hex", () => {
    expect(color(0xff0000, "hex")).toBe("#ff0000");
  });

  it("converts rgb object to hex", () => {
    expect(color({ r: 255, g: 0, b: 0 }, "hex")).toBe("#ff0000");
  });

  it("converts array to hex", () => {
    expect(color([255, 0, 0], "hex")).toBe("#ff0000");
  });

  it("converts to number", () => {
    expect(color("red", "number")).toBe(0xff0000);
  });

  it("converts to rgb string", () => {
    expect(color("red", "rgb")).toBe("rgb(255, 0, 0)");
  });

  it("converts to {rgba} object", () => {
    const result = color("red", "{rgba}");
    expect(result.r).toBe(255);
    expect(result.g).toBe(0);
    expect(result.b).toBe(0);
    expect(result.a).toBe(1);
  });

  it("converts to [rgb] array", () => {
    expect(color("red", "[rgb]")).toEqual([255, 0, 0]);
  });

  it("converts to hsl", () => {
    const result = color("red", "hsl");
    expect(result).toMatch(/hsl\(0, 100%, 50%\)/);
  });

  it("converts to ansi", () => {
    const result = color("red", "ansi");
    expect(result).toContain("\x1b[38;2;255;0;0m");
  });

  it("converts to css", () => {
    expect(color("red", "css")).toBe("red");
  });

  it("returns null for invalid input", () => {
    expect(color("notacolor", "hex")).toBeNull();
  });

  it("handles hsl input", () => {
    expect(color("hsl(0, 100%, 50%)", "hex")).toBe("#ff0000");
  });

  it("handles rgba input", () => {
    expect(color("rgba(255, 0, 0, 1)", "hex")).toBe("#ff0000");
  });
});

// --- Cookie ---

describe("Bun.Cookie", () => {
  it("creates a cookie from name and value", () => {
    const c = new Cookie("session", "abc123");
    expect(c.name).toBe("session");
    expect(c.value).toBe("abc123");
    expect(c.path).toBe("/");
    expect(c.sameSite).toBe("lax");
  });

  it("creates a cookie with options", () => {
    const c = new Cookie("session", "abc123", {
      secure: true,
      httpOnly: true,
      maxAge: 3600,
    });
    expect(c.secure).toBe(true);
    expect(c.httpOnly).toBe(true);
    expect(c.maxAge).toBe(3600);
  });

  it("serializes to Set-Cookie header", () => {
    const c = new Cookie("session", "abc123", { secure: true });
    const str = c.serialize();
    expect(str).toContain("session=abc123");
    expect(str).toContain("Secure");
    expect(str).toContain("Path=/");
  });

  it("parses a Set-Cookie string", () => {
    const c = Cookie.parse("session=abc123; Path=/; Secure; HttpOnly");
    expect(c.name).toBe("session");
    expect(c.value).toBe("abc123");
    expect(c.secure).toBe(true);
    expect(c.httpOnly).toBe(true);
  });

  it("isExpired returns false for no expiry", () => {
    const c = new Cookie("session", "abc123");
    expect(c.isExpired()).toBe(false);
  });

  it("isExpired returns true for past expiry", () => {
    const c = new Cookie("session", "abc123", { expires: new Date(0) });
    expect(c.isExpired()).toBe(true);
  });

  it("isExpired returns true for maxAge 0", () => {
    const c = new Cookie("session", "abc123", { maxAge: 0 });
    expect(c.isExpired()).toBe(true);
  });

  it("toJSON returns plain object", () => {
    const c = new Cookie("session", "abc123");
    const json = c.toJSON();
    expect(json.name).toBe("session");
    expect(json.value).toBe("abc123");
  });

  it("Cookie.from creates a cookie", () => {
    const c = Cookie.from("test", "value");
    expect(c.name).toBe("test");
    expect(c.value).toBe("value");
  });
});

// --- CookieMap ---

describe("Bun.CookieMap", () => {
  it("creates empty map", () => {
    const map = new CookieMap();
    expect(map.size).toBe(0);
  });

  it("parses cookie string", () => {
    const map = new CookieMap("session=abc123; theme=dark");
    expect(map.get("session")).toBe("abc123");
    expect(map.get("theme")).toBe("dark");
  });

  it("creates from object", () => {
    const map = new CookieMap({ session: "abc123", theme: "dark" });
    expect(map.get("session")).toBe("abc123");
  });

  it("creates from array of pairs", () => {
    const map = new CookieMap([["session", "abc123"]]);
    expect(map.get("session")).toBe("abc123");
  });

  it("has() checks existence", () => {
    const map = new CookieMap("session=abc123");
    expect(map.has("session")).toBe(true);
    expect(map.has("other")).toBe(false);
  });

  it("set() adds cookies", () => {
    const map = new CookieMap();
    map.set("theme", "dark");
    expect(map.get("theme")).toBe("dark");
  });

  it("delete() removes cookies", () => {
    const map = new CookieMap("session=abc123");
    map.delete("session");
    expect(map.get("session")).toBeNull();
  });

  it("toJSON returns plain object", () => {
    const map = new CookieMap("a=1; b=2");
    expect(map.toJSON()).toEqual({ a: "1", b: "2" });
  });

  it("iterates entries", () => {
    const map = new CookieMap("a=1; b=2");
    const entries = [...map];
    expect(entries).toEqual([["a", "1"], ["b", "2"]]);
  });

  it("keys() returns cookie names", () => {
    const map = new CookieMap("a=1; b=2");
    expect([...map.keys()]).toEqual(["a", "b"]);
  });

  it("values() returns cookie values", () => {
    const map = new CookieMap("a=1; b=2");
    expect([...map.values()]).toEqual(["1", "2"]);
  });

  it("toSetCookieHeaders returns array", () => {
    const map = new CookieMap();
    map.set("a", "1");
    const headers = map.toSetCookieHeaders();
    expect(headers.length).toBe(1);
    expect(headers[0]).toContain("a=1");
  });
});

// --- CSRF ---

describe("Bun.CSRF", () => {
  it("generates a token", () => {
    const token = CSRF.generate("my-secret");
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });

  it("verifies a valid token", () => {
    const token = CSRF.generate("my-secret");
    expect(CSRF.verify(token, { secret: "my-secret" })).toBe(true);
  });

  it("rejects token with wrong secret", () => {
    const token = CSRF.generate("my-secret");
    expect(CSRF.verify(token, { secret: "wrong-secret" })).toBe(false);
  });

  it("rejects tampered token", () => {
    const token = CSRF.generate("my-secret");
    expect(CSRF.verify(token + "tampered", { secret: "my-secret" })).toBe(false);
  });

  it("respects expiresIn", () => {
    const token = CSRF.generate("my-secret", { expiresIn: 1 });
    // Immediately should be valid
    expect(CSRF.verify(token, { secret: "my-secret" })).toBe(true);
  });

  it("generates with hex encoding", () => {
    const token = CSRF.generate("my-secret", { encoding: "hex" });
    expect(CSRF.verify(token, { secret: "my-secret", encoding: "hex" })).toBe(true);
  });

  it("generates with sha512 algorithm", () => {
    const token = CSRF.generate("my-secret", { algorithm: "sha512" });
    expect(CSRF.verify(token, { secret: "my-secret", algorithm: "sha512" })).toBe(true);
  });
});

// --- markdown ---

describe("Bun.markdown", () => {
  it("html() converts markdown to HTML", () => {
    const result = markdown.html("# Hello **world**");
    expect(result).toContain("<h1");
    expect(result).toContain("<strong>world</strong>");
  });

  it("html() supports GFM tables by default", () => {
    const result = markdown.html(`
| A | B |
|---|---|
| 1 | 2 |
`);
    expect(result).toContain("<table");
    expect(result).toContain("<td");
  });

  it("ansi() converts to ANSI text", () => {
    const result = markdown.ansi("# Hello **world**");
    expect(result).toContain("\x1b[");
    expect(result).toContain("Hello");
    expect(result).toContain("world");
  });

  it("render() with custom callbacks", () => {
    const result = markdown.render("# Hello", {
      heading: (children, { level }) => `<h${level} class="custom">${children}</h${level}>`,
      paragraph: children => children,
    });
    expect(result).toContain('class="custom"');
  });

  it("render() strips formatting", () => {
    const result = markdown.render("# Title\n\nHello **world**", {
      heading: children => children,
      paragraph: children => children,
      strong: children => children,
    });
    expect(result).toContain("Title");
    expect(result).toContain("Hello");
    expect(result).toContain("world");
  });
});

// --- Image ---

describe("Bun.Image", () => {
  it("constructs from buffer", async () => {
    // Create a 1x1 red PNG
    const sharp = (await import("sharp")).default;
    const buf = await sharp({
      create: { width: 1, height: 1, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } },
    }).png().toBuffer();

    const img = new Image(buf);
    const meta = await img.metadata();
    expect(meta.width).toBe(1);
    expect(meta.height).toBe(1);
    expect(meta.format).toBe("png");
  });

  it("resizes an image", async () => {
    const sharp = (await import("sharp")).default;
    const buf = await sharp({
      create: { width: 100, height: 100, channels: 4, background: { r: 0, g: 0, b: 255, alpha: 1 } },
    }).png().toBuffer();

    const img = new Image(buf);
    const resized = await img.resize(50, 50).png().bytes();
    expect(resized.length).toBeGreaterThan(0);

    const meta = await sharp(Buffer.from(resized)).metadata();
    expect(meta.width).toBe(50);
    expect(meta.height).toBe(50);
  });

  it("converts to jpeg", async () => {
    const sharp = (await import("sharp")).default;
    const buf = await sharp({
      create: { width: 10, height: 10, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 1 } },
    }).png().toBuffer();

    const img = new Image(buf);
    const jpeg = await img.jpeg({ quality: 80 }).buffer();
    expect(jpeg.length).toBeGreaterThan(0);

    const meta = await sharp(jpeg).metadata();
    expect(meta.format).toBe("jpeg");
  });

  it("converts to webp", async () => {
    const sharp = (await import("sharp")).default;
    const buf = await sharp({
      create: { width: 10, height: 10, channels: 4, background: { r: 0, g: 0, b: 255, alpha: 1 } },
    }).png().toBuffer();

    const img = new Image(buf);
    const webp = await img.webp({ quality: 80 }).buffer();
    expect(webp.length).toBeGreaterThan(0);
  });

  it("returns base64", async () => {
    const sharp = (await import("sharp")).default;
    const buf = await sharp({
      create: { width: 1, height: 1, channels: 4, background: { r: 255, g: 255, b: 0, alpha: 1 } },
    }).png().toBuffer();

    const img = new Image(buf);
    const b64 = await img.png().toBase64();
    expect(typeof b64).toBe("string");
    expect(b64.length).toBeGreaterThan(0);
  });
});
