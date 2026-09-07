/** Browser-side image preprocessing for legal-metrology label photographs.
 *  Everything here runs in the main thread using the Canvas API so no server
 *  binaries or extra API keys are required. */

export type PreprocessOptions = {
  /** Correct EXIF orientation (1-8). */
  orientation?: number;
  /** Straighten the image by a given angle in degrees. */
  rotation?: number;
  /** Four corner points for perspective correction, in normalized 0-1 coords. */
  corners?: { x: number; y: number }[];
  /** Increase or decrease brightness, -1 to 1. */
  brightness?: number;
  /** Increase or decrease contrast, -1 to 1. */
  contrast?: number;
  /** Apply histogram equalization. */
  equalize?: boolean;
  /** Convert to grayscale. */
  grayscale?: boolean;
  /** Longest edge in pixels. OCR models handle roughly 1024-2048 px best. */
  maxDimension?: number;
};

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, 0), 1);

/** Loads an image from a File or data URL and returns an HTMLImageElement. */
export function loadImage(source: File | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The image could not be loaded."));
    if (typeof source === "string") {
      img.src = source;
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        img.src = String(reader.result);
      };
      reader.onerror = () => reject(new Error("The image file could not be read."));
      reader.readAsDataURL(source);
    }
  });
}

/** Reads EXIF orientation from a JPEG file without external libraries. */
export async function readOrientation(file: File): Promise<number> {
  if (!file.type.startsWith("image/jpeg")) return 1;
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  if (view.getUint16(0, false) !== 0xffd8) return 1;
  let offset = 2;
  while (offset < view.byteLength) {
    if (view.getUint16(offset, false) === 0xffe1) {
      const exifOffset = offset + 4;
      const littleEndian = view.getUint16(exifOffset + 8, false) === 0x4949;
      const dirOffset = view.getUint32(exifOffset + 10, littleEndian);
      const dirStart = exifOffset + 6 + dirOffset;
      const entries = view.getUint16(dirStart, littleEndian);
      for (let i = 0; i < entries; i++) {
        const entry = dirStart + 2 + i * 12;
        const tag = view.getUint16(entry, littleEndian);
        if (tag === 0x0112) return view.getUint16(entry + 8, littleEndian);
      }
      return 1;
    }
    const segmentLength = view.getUint16(offset + 2, false);
    offset += 2 + segmentLength;
  }
  return 1;
}

/** Applies orientation and optional rotation to canvas dimensions. */
function orientedSize(width: number, height: number, orientation: number, rotationDeg: number) {
  let swap = orientation === 5 || orientation === 6 || orientation === 7 || orientation === 8;
  if (Math.abs(rotationDeg) === 90 || Math.abs(rotationDeg) === 270) swap = !swap;
  return { width: swap ? height : width, height: swap ? width : height };
}

/** Draws an image onto a canvas with orientation and rotation applied. */
function drawOriented(ctx: CanvasRenderingContext2D, img: HTMLImageElement, width: number, height: number, orientation: number, rotationDeg: number) {
  ctx.translate(width / 2, height / 2);
  let angle = (rotationDeg * Math.PI) / 180;
  switch (orientation) {
    case 2: ctx.scale(-1, 1); break;
    case 3: angle += Math.PI; break;
    case 4: ctx.scale(1, -1); break;
    case 5: angle += Math.PI / 2; ctx.scale(1, -1); break;
    case 6: angle += Math.PI / 2; break;
    case 7: angle += Math.PI / 2; ctx.scale(-1, 1); break;
    case 8: angle -= Math.PI / 2; break;
  }
  ctx.rotate(angle);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
}

/** Perspective-corrects an image using four corner points. */
function perspectiveCorrect(ctx: CanvasRenderingContext2D, img: HTMLImageElement, corners: { x: number; y: number }[], width: number, height: number) {
  if (corners.length !== 4) return;
  const src = corners.map((c) => ({ x: clamp(c.x, 0, 1) * img.width, y: clamp(c.y, 0, 1) * img.height }));
  const dst = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];

  // Compute the homography matrix (3x3) from src to dst using Direct Linear Transform.
  const A: number[][] = [];
  const B: number[] = [];
  for (let i = 0; i < 4; i++) {
    const s = src[i]!;
    const d = dst[i]!;
    A.push([s.x, s.y, 1, 0, 0, 0, -d.x * s.x, -d.x * s.y]);
    A.push([0, 0, 0, s.x, s.y, 1, -d.y * s.x, -d.y * s.y]);
    B.push(d.x, d.y);
  }
  const h = solveLinearSystem(A, B);
  if (!h) return;
  const H = [h[0]!, h[1]!, h[2]!, h[3]!, h[4]!, h[5]!, h[6]!, h[7]!, 1];

  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = img.width;
  srcCanvas.height = img.height;
  const srcCtx = srcCanvas.getContext("2d")!;
  srcCtx.drawImage(img, 0, 0);
  const srcData = srcCtx.getImageData(0, 0, img.width, img.height);

  const outData = ctx.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const denom = H[6]! * x + H[7]! * y + 1;
      const sx = (H[0]! * x + H[1]! * y + H[2]!) / denom;
      const sy = (H[3]! * x + H[4]! * y + H[5]!) / denom;
      const sample = bilinearSample(srcData, sx, sy);
      const idx = (y * width + x) * 4;
      outData.data[idx] = sample.r;
      outData.data[idx + 1] = sample.g;
      outData.data[idx + 2] = sample.b;
      outData.data[idx + 3] = sample.a;
    }
  }
  ctx.putImageData(outData, 0, 0);
}

function solveLinearSystem(A: number[][], B: number[]): number[] | null {
  const n = A.length;
  const M: number[][] = A.map((row, i) => [...row, B[i]!]);
  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(M[j]![i]!) > Math.abs(M[pivot]![i]!)) pivot = j;
    }
    if (Math.abs(M[pivot]![i]!) < 1e-10) return null;
    const tmp = M[i]!;
    M[i] = M[pivot]!;
    M[pivot] = tmp;
    for (let j = i + 1; j < n; j++) {
      const factor = M[j]![i]! / M[i]![i]!;
      for (let k = i; k <= n; k++) {
        M[j]![k] = (M[j]![k] ?? 0) - factor * (M[i]![k] ?? 0);
      }
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i]![n]!;
    for (let j = i + 1; j < n; j++) sum -= (M[i]![j] ?? 0) * x[j]!;
    x[i] = sum / M[i]![i]!;
  }
  return x;
}

function bilinearSample(img: ImageData, x: number, y: number) {
  const w = img.width;
  const h = img.height;
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(x0 + 1, w - 1);
  const y1 = Math.min(y0 + 1, h - 1);
  const fx = x - x0;
  const fy = y - y0;
  const i00 = (y0 * w + x0) * 4;
  const i10 = (y0 * w + x1) * 4;
  const i01 = (y1 * w + x0) * 4;
  const i11 = (y1 * w + x1) * 4;
  const sample = (offset: number) => {
    const v00 = img.data[i00 + offset]!;
    const v10 = img.data[i10 + offset]!;
    const v01 = img.data[i01 + offset]!;
    const v11 = img.data[i11 + offset]!;
    return (1 - fx) * (1 - fy) * v00 + fx * (1 - fy) * v10 + (1 - fx) * fy * v01 + fx * fy * v11;
  };
  return { r: sample(0), g: sample(1), b: sample(2), a: sample(3) };
}

/** Applies brightness, contrast, grayscale and histogram equalization to image data. */
function adjustPixels(data: ImageData, options: PreprocessOptions) {
  const brightness = options.brightness ?? 0;
  const contrast = options.contrast ?? 0;
  const grayscale = options.grayscale ?? false;
  const equalize = options.equalize ?? false;
  const pixels = data.data;
  const len = pixels.length / 4;

  // Contrast/brightness constants.
  const contrastFactor = contrast === 0 ? 1 : (1 + contrast);
  const brightnessOffset = brightness * 255;

  // Grayscale pass.
  if (grayscale) {
    for (let i = 0; i < len; i++) {
      const idx = i * 4;
      const lum = 0.299 * pixels[idx]! + 0.587 * pixels[idx + 1]! + 0.114 * pixels[idx + 2]!;
      pixels[idx] = lum;
      pixels[idx + 1] = lum;
      pixels[idx + 2] = lum;
    }
  }

  // Contrast/brightness pass.
  for (let i = 0; i < len; i++) {
    const idx = i * 4;
    for (let c = 0; c < 3; c++) {
      const v = (pixels[idx + c]! - 128) * contrastFactor + 128 + brightnessOffset;
      pixels[idx + c] = Math.min(Math.max(v, 0), 255);
    }
  }

  // Histogram equalization (on luminance when grayscale, else on each channel).
  if (equalize) {
    if (grayscale) {
      const hist = new Array(256).fill(0);
      for (let i = 0; i < len; i++) hist[pixels[i * 4]!]++;
      const cdf = new Array(256).fill(0);
      cdf[0] = hist[0]!;
      for (let i = 1; i < 256; i++) cdf[i] = cdf[i - 1]! + hist[i]!;
      const minCdf = cdf.find((v) => v > 0) ?? 0;
      const scale = len > minCdf ? 255 / (len - minCdf) : 0;
      for (let i = 0; i < len; i++) {
        const idx = i * 4;
        const mapped = Math.round((cdf[pixels[idx]!]! - minCdf) * scale);
        pixels[idx] = mapped;
        pixels[idx + 1] = mapped;
        pixels[idx + 2] = mapped;
      }
    } else {
      for (let c = 0; c < 3; c++) {
        const hist = new Array(256).fill(0);
        for (let i = 0; i < len; i++) hist[pixels[i * 4 + c]!]++;
        const cdf = new Array(256).fill(0);
        cdf[0] = hist[0]!;
        for (let i = 1; i < 256; i++) cdf[i] = cdf[i - 1]! + hist[i]!;
        const minCdf = cdf.find((v) => v > 0) ?? 0;
        const scale = len > minCdf ? 255 / (len - minCdf) : 0;
        for (let i = 0; i < len; i++) {
          const idx = i * 4 + c;
          pixels[idx] = Math.round((cdf[pixels[idx]!]! - minCdf) * scale);
        }
      }
    }
  }
}

/** Resizes dimensions so the longest edge does not exceed maxDimension. */
function fitDimensions(width: number, height: number, maxDimension: number) {
  if (maxDimension <= 0) return { width, height };
  const longest = Math.max(width, height);
  if (longest <= maxDimension) return { width, height };
  const scale = maxDimension / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Preprocesses an image file or data URL and returns a data URL ready for OCR. */
export async function preprocessImage(source: File | string, options: PreprocessOptions = {}): Promise<string> {
  const img = await loadImage(source);
  const orientation = options.orientation ?? (typeof source !== "string" ? await readOrientation(source).catch(() => 1) : 1);
  const rotation = options.rotation ?? 0;
  const { width: baseWidth, height: baseHeight } = orientedSize(img.width, img.height, orientation, rotation);
  const { width, height } = fitDimensions(baseWidth, baseHeight, options.maxDimension ?? 1600);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  if (options.corners && options.corners.length === 4) {
    perspectiveCorrect(ctx, img, options.corners, width, height);
  } else {
    drawOriented(ctx, img, width, height, orientation, rotation);
  }

  const imageData = ctx.getImageData(0, 0, width, height);
  adjustPixels(imageData, options);
  ctx.putImageData(imageData, 0, 0);

  return canvas.toDataURL("image/jpeg", 0.92);
}

/** Quick auto-enhance preset: orientation correction, mild contrast and resize. */
export async function autoEnhance(source: File | string, orientation?: number): Promise<string> {
  return preprocessImage(source, {
    orientation: orientation ?? 1,
    contrast: 0.15,
    brightness: 0.05,
    equalize: false,
    grayscale: false,
    maxDimension: 1600,
  });
}
