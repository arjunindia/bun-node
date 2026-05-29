import semverLib from "semver";

const semver = {
  satisfies(version, range) {
    try {
      return semverLib.satisfies(version, range);
    } catch {
      return false;
    }
  },

  order(a, b) {
    const cmp = semverLib.compare(a, b);
    return cmp; // -1, 0, 1
  },
};

export { semver };
export default semver;
