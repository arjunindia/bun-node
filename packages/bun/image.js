import sharp from "sharp";

class Image {
  #pipeline;
  #metadata;
  #options;
  #outputFormat;
  #outputOptions;
  #width;
  #height;

  constructor(input, options = {}) {
    this.#options = options;
    this.#outputFormat = null;
    this.#outputOptions = {};
    this.#width = -1;
    this.#height = -1;

    if (typeof input === "string") {
      this.#pipeline = sharp(input, { autoOrient: options.autoOrient ?? true });
    } else if (input instanceof Blob) {
      // Convert Blob to buffer
      this.#pipeline = null; // Will be initialized async
      this.#initFromBlob(input);
    } else if (Buffer.isBuffer(input) || ArrayBuffer.isView(input) || input instanceof ArrayBuffer) {
      const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
      this.#pipeline = sharp(buf, { autoOrient: options.autoOrient ?? true });
    } else {
      throw new TypeError("Invalid input type for Bun.Image");
    }
  }

  async #initFromBlob(input) {
    const buf = Buffer.from(await input.arrayBuffer());
    this.#pipeline = sharp(buf, { autoOrient: this.#options.autoOrient ?? true });
  }

  resize(width, height, options = {}) {
    const opts = {};
    if (options.fit === "inside") {
      opts.fit = sharp.fit.inside;
    } else {
      opts.fit = sharp.fit.fill;
    }
    opts.withoutEnlargement = options.withoutEnlargement ?? false;

    this.#pipeline = this.#pipeline.resize(width, height || null, opts);
    return this;
  }

  rotate(degrees) {
    this.#pipeline = this.#pipeline.rotate(degrees);
    return this;
  }

  flip() {
    this.#pipeline = this.#pipeline.flip();
    return this;
  }

  flop() {
    this.#pipeline = this.#pipeline.flop();
    return this;
  }

  modulate(options = {}) {
    const opts = {};
    if (options.brightness !== undefined) opts.brightness = options.brightness;
    if (options.saturation !== undefined) opts.saturation = options.saturation;
    this.#pipeline = this.#pipeline.modulate(opts);
    return this;
  }

  jpeg(options = {}) {
    this.#outputFormat = "jpeg";
    this.#outputOptions = { quality: options.quality ?? 80, progressive: options.progressive ?? false };
    return this;
  }

  png(options = {}) {
    this.#outputFormat = "png";
    this.#outputOptions = {
      compressionLevel: options.compressionLevel ?? 6,
      palette: options.palette ?? false,
      colours: options.colors ?? 64,
      dither: options.dither ?? 1,
    };
    return this;
  }

  webp(options = {}) {
    this.#outputFormat = "webp";
    this.#outputOptions = { quality: options.quality ?? 80, lossless: options.lossless ?? false };
    return this;
  }

  heic(options = {}) {
    this.#outputFormat = "heic";
    this.#outputOptions = { quality: options.quality ?? 80 };
    return this;
  }

  avif(options = {}) {
    this.#outputFormat = "avif";
    this.#outputOptions = { quality: options.quality ?? 60 };
    return this;
  }

  async #applyFormat() {
    if (this.#outputFormat) {
      this.#pipeline = this.#pipeline[this.#outputFormat](this.#outputOptions);
    }
  }

  async bytes() {
    await this.#applyFormat();
    const buf = await this.#pipeline.toBuffer({ resolveWithObject: true });
    this.#width = buf.info.width;
    this.#height = buf.info.height;
    return new Uint8Array(buf.data.buffer, buf.data.byteOffset, buf.data.byteLength);
  }

  async buffer() {
    await this.#applyFormat();
    const result = await this.#pipeline.toBuffer({ resolveWithObject: true });
    this.#width = result.info.width;
    this.#height = result.info.height;
    return result.data;
  }

  async blob() {
    const buf = await this.buffer();
    const mime = this.#outputFormat === "jpeg" ? "image/jpeg"
      : this.#outputFormat === "png" ? "image/png"
      : this.#outputFormat === "webp" ? "image/webp"
      : this.#outputFormat === "heic" ? "image/heic"
      : this.#outputFormat === "avif" ? "image/avif"
      : "application/octet-stream";
    return new Blob([buf], { type: mime });
  }

  async toBase64() {
    const buf = await this.buffer();
    return buf.toString("base64");
  }

  async dataurl() {
    const b64 = await this.toBase64();
    const mime = this.#outputFormat === "jpeg" ? "image/jpeg"
      : this.#outputFormat === "png" ? "image/png"
      : this.#outputFormat === "webp" ? "image/webp"
      : "application/octet-stream";
    return `data:${mime};base64,${b64}`;
  }

  async write(dest) {
    await this.#applyFormat();
    const buf = await this.#pipeline.toBuffer();
    if (typeof dest === "string") {
      const fs = await import("node:fs/promises");
      await fs.writeFile(dest, buf);
      return buf.length;
    }
    throw new TypeError("Unsupported write destination");
  }

  async metadata() {
    const meta = await this.#pipeline.metadata();
    return { width: meta.width, height: meta.height, format: meta.format };
  }

  get width() { return this.#width; }
  get height() { return this.#height; }

  static fromClipboard() {
    // Not implemented - requires native clipboard access
    return null;
  }
}

export { Image };
export default Image;
