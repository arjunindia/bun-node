// CSS named colors
const namedColors = {
  black: [0, 0, 0], white: [255, 255, 255], red: [255, 0, 0],
  green: [0, 128, 0], blue: [0, 0, 255], yellow: [255, 255, 0],
  cyan: [0, 255, 255], magenta: [255, 0, 255], gray: [128, 128, 128],
  grey: [128, 128, 128], silver: [192, 192, 192], maroon: [128, 0, 0],
  purple: [128, 0, 128], fuchsia: [255, 0, 255], lime: [0, 255, 0],
  olive: [128, 128, 0], navy: [0, 0, 128], teal: [0, 128, 128],
  aqua: [0, 255, 255], orange: [255, 165, 0], pink: [255, 192, 203],
  brown: [165, 42, 42], coral: [255, 127, 80], gold: [255, 215, 0],
  indigo: [75, 0, 130], ivory: [255, 255, 240], khaki: [240, 230, 140],
  lavender: [230, 230, 250], salmon: [250, 128, 114], tan: [210, 180, 140],
  tomato: [255, 99, 71], turquoise: [64, 224, 208], violet: [238, 130, 238],
  wheat: [245, 222, 179], plum: [221, 160, 221], orchid: [218, 112, 214],
  sienna: [160, 82, 45], peru: [205, 133, 63], chocolate: [210, 105, 30],
  crimson: [220, 20, 60], darkred: [139, 0, 0], firebrick: [178, 34, 34],
  darkgreen: [0, 100, 0], forestgreen: [34, 139, 34], seagreen: [46, 139, 87],
  springgreen: [0, 255, 127], limegreen: [50, 205, 50],
  darkblue: [0, 0, 139], dodgerblue: [30, 144, 255], steelblue: [70, 130, 180],
  skyblue: [135, 206, 235], royalblue: [65, 105, 225],
};

function parseColor(input) {
  if (input === null || input === undefined) return null;

  if (typeof input === "object" && !Array.isArray(input) && "r" in input) {
    return { r: input.r, g: input.g, b: input.b, a: input.a ?? 1 };
  }

  if (Array.isArray(input)) {
    return { r: input[0], g: input[1], b: input[2], a: input[3] !== undefined ? input[3] / 255 : 1 };
  }

  if (typeof input === "number") {
    return { r: (input >> 16) & 0xff, g: (input >> 8) & 0xff, b: input & 0xff, a: 1 };
  }

  const str = String(input).trim().toLowerCase();

  if (namedColors[str]) {
    const [r, g, b] = namedColors[str];
    return { r, g, b, a: 1 };
  }

  const hexMatch = str.match(/^#?([0-9a-f]{3,8})$/);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    if (hex.length === 4) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    if (hex.length === 6 || hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
      };
    }
  }

  const rgbMatch = str.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/);
  if (rgbMatch) {
    return { r: parseInt(rgbMatch[1]), g: parseInt(rgbMatch[2]), b: parseInt(rgbMatch[3]), a: rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1 };
  }

  const hslMatch = str.match(/^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+))?\s*\)$/);
  if (hslMatch) {
    const h = parseFloat(hslMatch[1]) / 360;
    const s = parseFloat(hslMatch[2]) / 100;
    const l = parseFloat(hslMatch[3]) / 100;
    const a = hslMatch[4] !== undefined ? parseFloat(hslMatch[4]) : 1;
    return { ...hslToRgb(h, s, l), a };
  }

  return null;
}

function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function hue2rgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s; const l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function rgbToAnsi256(r, g, b) {
  if (r === g && g === b) {
    if (r < 8) return 16;
    if (r > 248) return 231;
    return Math.round(((r - 8) / 247) * 24) + 232;
  }
  return 16 + Math.round(r / 255 * 5) * 36 + Math.round(g / 255 * 5) * 6 + Math.round(b / 255 * 5);
}

function ansi256ToAnsi16(code) {
  if (code >= 232) return 0;
  if (code >= 16) {
    const r = Math.floor(((code - 16) / 36) % 6);
    const g = Math.floor(((code - 16) / 6) % 6);
    const b = Math.floor((code - 16) % 6);
    return (r >= 3 ? 1 : 0) | (g >= 3 ? 2 : 0) | (b >= 3 ? 4 : 0) | (r + g + b >= 8 ? 8 : 0);
  }
  return code;
}

function color(input, format) {
  const rgba = parseColor(input);
  if (!rgba) return null;

  const { r, g, b, a } = rgba;
  const ri = Math.round(r), gi = Math.round(g), bi = Math.round(b);

  switch (format) {
    case "css":
    case undefined: {
      if (a === 1) {
        for (const [name, rgb] of Object.entries(namedColors)) {
          if (rgb[0] === ri && rgb[1] === gi && rgb[2] === bi) return name;
        }
        return `#${ri.toString(16).padStart(2, "0")}${gi.toString(16).padStart(2, "0")}${bi.toString(16).padStart(2, "0")}`;
      }
      return `rgba(${ri}, ${gi}, ${bi}, ${a})`;
    }
    case "hex":
      return `#${ri.toString(16).padStart(2, "0")}${gi.toString(16).padStart(2, "0")}${bi.toString(16).padStart(2, "0")}`;
    case "HEX":
      return `#${ri.toString(16).padStart(2, "0").toUpperCase()}${gi.toString(16).padStart(2, "0").toUpperCase()}${bi.toString(16).padStart(2, "0").toUpperCase()}`;
    case "rgb": return `rgb(${ri}, ${gi}, ${bi})`;
    case "rgba": return `rgba(${ri}, ${gi}, ${bi}, ${a})`;
    case "hsl": {
      const [h, s, l] = rgbToHsl(ri, gi, bi);
      return `hsl(${h}, ${s}%, ${l}%)`;
    }
    case "number": return (ri << 16) | (gi << 8) | bi;
    case "ansi":
    case "ansi-16m": return `\x1b[38;2;${ri};${gi};${bi}m`;
    case "ansi-256": return `\x1b[38;5;${rgbToAnsi256(ri, gi, bi)}m`;
    case "ansi-16": return `\x1b[38;5;${ansi256ToAnsi16(rgbToAnsi256(ri, gi, bi))}m`;
    case "{rgb}": return { r: ri, g: gi, b: bi };
    case "{rgba}": return { r: ri, g: gi, b: bi, a };
    case "[rgb]": return [ri, gi, bi];
    case "[rgba]": return [ri, gi, bi, Math.round(a * 255)];
    default: return null;
  }
}

export { color };
export default color;
