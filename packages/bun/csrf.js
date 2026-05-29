import crypto from "node:crypto";

let defaultSecret = null;

function getDefaultSecret() {
  if (!defaultSecret) defaultSecret = crypto.randomBytes(32).toString("hex");
  return defaultSecret;
}

const CSRF = {
  generate(secret, options = {}) {
    const key = secret ?? getDefaultSecret();
    const expiresIn = options.expiresIn ?? 86400000;
    const encoding = options.encoding ?? "base64url";
    const algorithm = options.algorithm ?? "sha256";

    const nonce = crypto.randomBytes(16).toString("hex");
    const timestamp = Date.now();
    const expires = timestamp + expiresIn;
    const payload = `${nonce}.${expires}`;
    const signature = crypto.createHmac(algorithm, key).update(payload).digest("base64url");

    const raw = `${payload}.${signature}`;
    if (encoding === "hex") return Buffer.from(raw).toString("hex");
    if (encoding === "base64") return Buffer.from(raw).toString("base64");
    return Buffer.from(raw).toString("base64url");
  },

  verify(token, options = {}) {
    try {
      const key = options.secret ?? getDefaultSecret();
      const encoding = options.encoding ?? "base64url";
      const algorithm = options.algorithm ?? "sha256";
      const maxAge = options.maxAge ?? 86400000;

      let raw;
      if (encoding === "hex") raw = Buffer.from(token, "hex").toString();
      else if (encoding === "base64") raw = Buffer.from(token, "base64").toString();
      else raw = Buffer.from(token, "base64url").toString();

      const parts = raw.split(".");
      if (parts.length !== 3) return false;

      const [nonce, expiresStr, signature] = parts;
      const expires = parseInt(expiresStr, 10);

      if (Date.now() > expires) return false;

      const age = Date.now() - (expires - maxAge);
      if (age > maxAge) return false;

      const payload = `${nonce}.${expires}`;
      const expectedSig = crypto.createHmac(algorithm, key).update(payload).digest("base64url");

      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
    } catch {
      return false;
    }
  },
};

export { CSRF };
export default CSRF;
