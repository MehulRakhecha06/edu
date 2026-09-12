/**
 * Server-side text extraction for uploaded documents.
 * PDFs via pdf-parse (pure JS — works on Vercel), TXT/MD read directly,
 * DOCX via mammoth (pure JS). Images carry no text — they are stored as
 * bytes and read by the AI service's vision endpoint instead.
 *
 * IMPORTANT — Vercel/serverless note:
 * pdf-parse → pdfjs-dist expects the browser globals DOMMatrix / Path2D /
 * ImageData. On a normal machine its optional native dependency
 * (@napi-rs/canvas) provides them, but native modules cannot load in
 * Vercel's serverless runtime, so PDF parsing used to crash there with
 * "ReferenceError: DOMMatrix is not defined". We therefore install tiny
 * polyfills FIRST (only when the globals are missing) and import pdf-parse
 * lazily AFTERWARDS — a static top-level import would be hoisted and
 * evaluated before the polyfills exist.
 */

// ---------------------------------------------------------------------------
// Minimal polyfills — enough for pdf.js TEXT extraction (no rendering)
// ---------------------------------------------------------------------------

/**
 * Spec-shaped DOMMatrix restricted to 2-D affine operations (everything
 * pdf.js uses outside an actual canvas). CSS column-major mapping:
 * a=m11 b=m12 c=m21 d=m22 e=m41 f=m42.
 */
class MiniDOMMatrix {
  constructor(init) {
    // identity
    this.m11 = 1; this.m12 = 0; this.m13 = 0; this.m14 = 0;
    this.m21 = 0; this.m22 = 1; this.m23 = 0; this.m24 = 0;
    this.m31 = 0; this.m32 = 0; this.m33 = 1; this.m34 = 0;
    this.m41 = 0; this.m42 = 0; this.m43 = 0; this.m44 = 1;

    if (Array.isArray(init)) {
      if (init.length === 6) {
        // [a, b, c, d, e, f]
        [this.m11, this.m12, this.m21, this.m22, this.m41, this.m42] = init;
      } else if (init.length === 16) {
        // column-major 4x4 — take the 2-D affine subset
        this.m11 = init[0];  this.m12 = init[1];
        this.m21 = init[4];  this.m22 = init[5];
        this.m41 = init[12]; this.m42 = init[13];
      }
    } else if (init && typeof init === 'object') {
      for (const k of ['m11','m12','m13','m14','m21','m22','m23','m24',
                       'm31','m32','m33','m34','m41','m42','m43','m44']) {
        if (typeof init[k] === 'number') this[k] = init[k];
      }
    }
  }

  get a() { return this.m11; }
  get b() { return this.m12; }
  get c() { return this.m21; }
  get d() { return this.m22; }
  get e() { return this.m41; }
  get f() { return this.m42; }
  get is2D() {
    return !(this.m13 || this.m14 || this.m23 || this.m24 ||
      this.m31 || this.m32 || this.m33 !== 1 || this.m34 || this.m43 || this.m44 !== 1);
  }
  get isIdentity() {
    return this.m11 === 1 && this.m12 === 0 && this.m21 === 0 && this.m22 === 1 &&
      this.m41 === 0 && this.m42 === 0;
  }

  /** NEW matrix = this × other (2-D affine). */
  _mult(o) {
    const m = new MiniDOMMatrix();
    m.m11 = this.m11 * o.m11 + this.m21 * o.m12;
    m.m12 = this.m12 * o.m11 + this.m22 * o.m12;
    m.m21 = this.m11 * o.m21 + this.m21 * o.m22;
    m.m22 = this.m12 * o.m21 + this.m22 * o.m22;
    m.m41 = this.m11 * o.m41 + this.m21 * o.m42 + this.m41;
    m.m42 = this.m12 * o.m41 + this.m22 * o.m42 + this.m42;
    return m;
  }

  _copyFrom(o) {
    for (const k of ['m11','m12','m13','m14','m21','m22','m23','m24',
                     'm31','m32','m33','m34','m41','m42','m43','m44']) {
      this[k] = o[k];
    }
    return this;
  }

  multiply(other) { return this._mult(other); }
  multiplySelf(other) { return this._copyFrom(this._mult(other)); }
  preMultiply(other) { return other._mult(this); }
  preMultiplySelf(other) { return this._copyFrom(other._mult(this)); }

  translate(x, y = 0) { return this._mult(MiniDOMMatrix.translation(x, y)); }
  translateSelf(x, y = 0) { return this._copyFrom(this._mult(MiniDOMMatrix.translation(x, y))); }

  scale(x, y = x) { return this._mult(MiniDOMMatrix.scaling(x, y)); }
  scaleSelf(x, y = x) { return this._copyFrom(this._mult(MiniDOMMatrix.scaling(x, y))); }

  rotate(degrees) { return this._mult(MiniDOMMatrix.rotation(degrees)); }
  rotateSelf(degrees) { return this._copyFrom(this._mult(MiniDOMMatrix.rotation(degrees))); }

  invert() { return this._inverse(); }
  invertSelf() { return this._copyFrom(this._inverse()); }

  _inverse() {
    const det = this.m11 * this.m22 - this.m12 * this.m21;
    const m = new MiniDOMMatrix();
    if (!det) return m; // non-invertible → identity (not hit on the text path)
    const inv = 1 / det;
    m.m11 = this.m22 * inv;
    m.m12 = -this.m12 * inv;
    m.m21 = -this.m21 * inv;
    m.m22 = this.m11 * inv;
    m.m41 = (this.m21 * this.m42 - this.m22 * this.m41) * inv;
    m.m42 = (this.m12 * this.m41 - this.m11 * this.m42) * inv;
    return m;
  }

  transformPoint(p) {
    const x = p && typeof p.x === 'number' ? p.x : 0;
    const y = p && typeof p.y === 'number' ? p.y : 0;
    return {
      x: this.m11 * x + this.m21 * y + this.m41,
      y: this.m12 * x + this.m22 * y + this.m42,
    };
  }

  static translation(x, y) {
    const t = new MiniDOMMatrix();
    t.m41 = x; t.m42 = y;
    return t;
  }
  static scaling(x, y) {
    const t = new MiniDOMMatrix();
    t.m11 = x; t.m22 = y;
    return t;
  }
  static rotation(degrees) {
    const rad = (degrees * Math.PI) / 180;
    const t = new MiniDOMMatrix();
    t.m11 = Math.cos(rad); t.m12 = Math.sin(rad);
    t.m21 = -Math.sin(rad); t.m22 = Math.cos(rad);
    return t;
  }
}

/** No-op Path2D — pdf.js only touches it when RENDERING to a canvas,
 *  which never happens for text extraction. */
class MiniPath2D {
  constructor() {}
  addPath() {}
  moveTo() {}
  lineTo() {}
  closePath() {}
  bezierCurveTo() {}
  quadraticCurveTo() {}
  arc() {}
  arcTo() {}
  ellipse() {}
  rect() {}
}

/** Minimal spec-shaped ImageData. */
class MiniImageData {
  constructor(dataOrWidth, widthOrHeight, heightMaybe) {
    if (typeof dataOrWidth === 'number') {
      this.width = dataOrWidth;
      this.height = widthOrHeight;
      this.data = new Uint8ClampedArray(dataOrWidth * widthOrHeight * 4);
    } else {
      this.data = dataOrWidth;
      this.width = widthOrHeight;
      this.height = heightMaybe;
    }
  }
}

/** Install the polyfills — only when the runtime lacks them. */
function ensureDomPolyfills() {
  const g = globalThis;
  if (!g.DOMMatrix) g.DOMMatrix = MiniDOMMatrix;
  if (!g.Path2D) g.Path2D = MiniPath2D;
  if (!g.ImageData) g.ImageData = MiniImageData;
}

// ---------------------------------------------------------------------------

export async function extractText(buffer, isPdf, filename = '') {
  const looksPdf = isPdf || /\.pdf$/i.test(filename || '') || buffer.subarray(0, 4).toString('latin1') === '%PDF';
  const looksDocx = /\.docx$/i.test(filename || '') || buffer.subarray(0, 2).toString('latin1') === 'PK';

  if (looksDocx && !looksPdf) {
    // Word document — extract the raw text (mammoth is pure JS)
    const mammoth = (await import('mammoth')).default;
    const result = await mammoth.extractRawText({ buffer });
    return { text: result?.value || '', warning: null };
  }

  if (!looksPdf) {
    // Plain text / markdown
    return { text: buffer.toString('utf8'), warning: null };
  }

  // PDF — polyfill the DOM globals first (see note at top of file), then
  // load pdf-parse lazily so it is evaluated only AFTER the polyfills.
  ensureDomPolyfills();
  const { PDFParse } = await import('pdf-parse');

  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return { text: result?.text || '', warning: null };
  } finally {
    try {
      await parser.destroy();
    } catch {
      /* ignore */
    }
  }
}
