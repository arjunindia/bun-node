export type CookieSameSite = "strict" | "lax" | "none";

export interface CookieInit {
  name?: string;
  value?: string;
  domain?: string;
  path?: string;
  expires?: number | Date | string;
  secure?: boolean;
  sameSite?: CookieSameSite;
  httpOnly?: boolean;
  partitioned?: boolean;
  maxAge?: number;
}

export interface CookieStoreDeleteOptions {
  name: string;
  domain?: string | null;
  path?: string;
}

export class Cookie {
  constructor(name: string, value: string);
  constructor(name: string, value: string, options: CookieInit);
  constructor(cookieString: string);
  constructor(options: CookieInit);
  readonly name: string;
  value: string;
  domain: string | null;
  path: string;
  expires: number | undefined;
  secure: boolean;
  sameSite: CookieSameSite;
  partitioned: boolean;
  maxAge: number | undefined;
  httpOnly: boolean;
  isExpired(): boolean;
  serialize(): string;
  toString(): string;
  toJSON(): CookieInit;
  static parse(cookieString: string): Cookie;
  static from(name: string, value: string, options?: CookieInit): Cookie;
}

export class CookieMap implements Iterable<[string, string]> {
  constructor();
  constructor(input: string);
  constructor(input: Record<string, string>);
  constructor(input: [string, string][]);
  get(name: string): string | null;
  has(name: string): boolean;
  set(name: string, value: string): void;
  set(options: CookieInit): void;
  set(cookie: Cookie): void;
  delete(name: string): void;
  delete(options: CookieStoreDeleteOptions): void;
  readonly size: number;
  toJSON(): Record<string, string>;
  toSetCookieHeaders(): string[];
  entries(): IterableIterator<[string, string]>;
  keys(): IterableIterator<string>;
  values(): IterableIterator<string>;
  forEach(callback: (value: string, name: string) => void): void;
  [Symbol.iterator](): IterableIterator<[string, string]>;
}
