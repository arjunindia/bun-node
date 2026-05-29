export type ColorFormat =
  | "css" | "ansi" | "ansi-16" | "ansi-256" | "ansi-16m"
  | "number" | "rgb" | "rgba" | "hsl"
  | "hex" | "HEX"
  | "{rgb}" | "{rgba}" | "[rgb]" | "[rgba]";

export type ColorInput = string | number | { r: number; g: number; b: number; a?: number } | number[];

export function color(input: ColorInput, format?: ColorFormat): any;
