import fg from "fast-glob";
import path from "node:path";

class Glob {
  #pattern;

  constructor(pattern) {
    this.#pattern = pattern;
  }

  match(pathStr) {
    // Convert glob pattern to regex
    const regex = this.#toRegex(this.#pattern);
    return regex.test(pathStr);
  }

  #toRegex(pattern) {
    let re = "";
    let i = 0;
    const specialChars = new Set([".", "(", ")", "+", "^", "$", "|", "\\"]);

    while (i < pattern.length) {
      const ch = pattern[i];

      if (ch === "*") {
        if (pattern[i + 1] === "*") {
          re += ".*";
          i += 2;
          if (pattern[i] === "/") i++;
          continue;
        }
        re += "[^/]*";
      } else if (ch === "?") {
        re += "[^/]";
      } else if (ch === "[") {
        let end = pattern.indexOf("]", i + 1);
        if (end === -1) {
          re += "\\[";
        } else {
          // Copy character class as-is (don't escape dots etc inside)
          re += pattern.slice(i, end + 1);
          i = end;
        }
      } else if (ch === "{") {
        let end = pattern.indexOf("}", i + 1);
        if (end === -1) {
          re += "\\{";
        } else {
          const alts = pattern.slice(i + 1, end).split(",");
          re += "(?:" + alts.map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")";
          i = end;
        }
      } else if (specialChars.has(ch)) {
        re += "\\" + ch;
      } else {
        re += ch;
      }
      i++;
    }
    return new RegExp("^" + re + "$");
  }

  scan(rootOrOptions) {
    const opts = typeof rootOrOptions === "string" ? { cwd: rootOrOptions } : (rootOrOptions || {});
    const cwd = opts.cwd || process.cwd();
    const options = {
      cwd,
      dot: opts.dot ?? false,
      absolute: opts.absolute ?? false,
      followSymlinks: opts.followSymlinks ?? false,
      throwErrorOnBrokenSymlink: opts.throwErrorOnBrokenSymlink ?? false,
      onlyFiles: opts.onlyFiles ?? true,
    };

    const stream = fg.stream(this.#pattern, options);
    const iter = stream[Symbol.asyncIterator]();

    return {
      [Symbol.asyncIterator]() {
        return {
          async next() {
            const { value, done } = await iter.next();
            if (done) return { done: true };
            return { value: String(value), done: false };
          },
        };
      },
    };
  }

  scanSync(rootOrOptions) {
    const opts = typeof rootOrOptions === "string" ? { cwd: rootOrOptions } : (rootOrOptions || {});
    const cwd = opts.cwd || process.cwd();
    return fg.sync(this.#pattern, {
      cwd,
      dot: opts.dot ?? false,
      absolute: opts.absolute ?? false,
      followSymlinks: opts.followSymlinks ?? false,
      throwErrorOnBrokenSymlink: opts.throwErrorOnBrokenSymlink ?? false,
      onlyFiles: opts.onlyFiles ?? true,
    });
  }
}

export { Glob };
export default Glob;
