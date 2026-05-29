export type CSRFAlgorithm = "blake2b256" | "blake2b512" | "sha256" | "sha384" | "sha512" | "sha512-256";

export interface CSRFGenerateOptions {
  expiresIn?: number;
  encoding?: "base64" | "base64url" | "hex";
  algorithm?: CSRFAlgorithm;
}

export interface CSRFVerifyOptions {
  secret?: string;
  encoding?: "base64" | "base64url" | "hex";
  algorithm?: CSRFAlgorithm;
  maxAge?: number;
}

export const CSRF: {
  generate(secret?: string, options?: CSRFGenerateOptions): string;
  verify(token: string, options?: CSRFVerifyOptions): boolean;
};
