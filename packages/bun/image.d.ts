export interface ResizeOptions {
  fit?: "fill" | "inside";
  withoutEnlargement?: boolean;
  filter?: string;
}

export class Image {
  constructor(input: string | Buffer | ArrayBuffer | Blob, options?: { maxPixels?: number; autoOrient?: boolean });
  resize(width: number, height?: number | null, options?: ResizeOptions): this;
  rotate(degrees: number): this;
  flip(): this;
  flop(): this;
  modulate(options?: { brightness?: number; saturation?: number }): this;
  jpeg(options?: { quality?: number; progressive?: boolean }): this;
  png(options?: { compressionLevel?: number; palette?: boolean; colors?: number; dither?: boolean }): this;
  webp(options?: { quality?: number; lossless?: boolean }): this;
  heic(options?: { quality?: number }): this;
  avif(options?: { quality?: number }): this;
  bytes(): Promise<Uint8Array>;
  buffer(): Promise<Buffer>;
  blob(): Promise<Blob>;
  toBase64(): Promise<string>;
  dataurl(): Promise<string>;
  write(dest: string): Promise<number>;
  metadata(): Promise<{ width: number; height: number; format: string }>;
  readonly width: number;
  readonly height: number;
  static fromClipboard(): Image | null;
}
