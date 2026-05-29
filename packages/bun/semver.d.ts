export const semver: {
  satisfies(version: string, range: string): boolean;
  order(a: string, b: string): -1 | 0 | 1;
};
