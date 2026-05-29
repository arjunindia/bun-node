import { parse } from "smol-toml";

const TOML = {
  parse(text) {
    return parse(text);
  },
};

export { TOML };
export default TOML;
