// Custom loader that maps bun:* protocol imports to the bun package subpaths
// Usage: node --loader ./packages/bun/loader.js your-script.js

const PROTOCOL = "bun:";

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(PROTOCOL)) {
    const subpath = specifier.slice(PROTOCOL.length);
    return nextResolve(`bun/${subpath}`, context);
  }
  return nextResolve(specifier, context);
}
