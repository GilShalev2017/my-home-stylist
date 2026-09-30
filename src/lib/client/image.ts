'use client';

export interface PreparedImage {
  dataUrl: string;
  width: number;
  height: number;
}

export type RenderSize = '1024x1024' | '1536x1024' | '1024x1536';

export interface RenderInput {
  dataUrl: string;
  size: RenderSize;
  padded: boolean;
  /** Where the original photo sits inside the padded canvas (pixels in the render size). */
  crop: { x: number; y: number; w: number; h: number };
}

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    // Respects EXIF orientation (iPhone photos) in modern browsers.
    return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      return img;
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
}

function dims(src: ImageBitmap | HTMLImageElement) {
  return 'naturalWidth' in src ? { w: src.naturalWidth, h: src.naturalHeight } : { w: src.width, h: src.height };
}

/** Decode any browser-readable photo (JPG/PNG/WebP; HEIC on Safari) and downscale to maxDim. */
export async function prepareUpload(file: File, maxDim = 1600): Promise<PreparedImage> {
  let src: ImageBitmap | HTMLImageElement;
  try {
    src = await decode(file);
  } catch {
    throw new Error(
      "We couldn't read this photo format. Please use a JPG or PNG. On iPhone, photos picked here are usually converted automatically — if not, set Settings › Camera › Formats › Most Compatible.",
    );
  }
  const { w, h } = dims(src);
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const width = Math.round(w * scale);
  const height = Math.round(h * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src as CanvasImageSource, 0, 0, width, height);
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.86), width, height };
}

const SIZES: { size: RenderSize; w: number; h: number }[] = [
  { size: '1024x1536', w: 1024, h: 1536 },
  { size: '1024x1024', w: 1024, h: 1024 },
  { size: '1536x1024', w: 1536, h: 1024 },
];

function loadImg(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`The browser couldn't decode an image (${Math.round(dataUrl.length / 1024)} KB, ${dataUrl.slice(5, dataUrl.indexOf(';'))}).`));
    img.src = dataUrl;
  });
}

/**
 * The image model only outputs a few aspect ratios. To keep the room exactly as photographed
 * (no crop, no stretch) we letterbox the photo into the nearest supported ratio and crop the
 * result back afterwards.
 */
export async function prepareForRender(img: PreparedImage): Promise<RenderInput> {
  const ratio = img.width / img.height;
  const best = SIZES.reduce((a, b) => (Math.abs(Math.log(ratio / (b.w / b.h))) < Math.abs(Math.log(ratio / (a.w / a.h))) ? b : a));
  const scale = Math.min(best.w / img.width, best.h / img.height);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const x = Math.floor((best.w - w) / 2);
  const y = Math.floor((best.h - h) / 2);
  const padded = w !== best.w || h !== best.h;
  const canvas = document.createElement('canvas');
  canvas.width = best.w;
  canvas.height = best.h;
  const ctx = canvas.getContext('2d')!;
  const el = await loadImg(img.dataUrl);
  if (padded) {
    // Fill bars with a blurred, stretched copy so edges look continuous (cropped away later).
    ctx.filter = 'blur(24px)';
    ctx.drawImage(el, -40, -40, best.w + 80, best.h + 80);
    ctx.filter = 'none';
  }
  ctx.drawImage(el, x, y, w, h);
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.9), size: best.size, padded, crop: { x, y, w, h } };
}

/** Crop the generated image back to the original photo's framing. */
export async function cropRenderResult(resultDataUrl: string, input: RenderInput, target: PreparedImage): Promise<string> {
  if (!input.padded) return resultDataUrl;
  const el = await loadImg(resultDataUrl);
  const [rw, rh] = input.size.split('x').map(Number);
  const sx = el.naturalWidth / rw;
  const sy = el.naturalHeight / rh;
  const canvas = document.createElement('canvas');
  const outScale = Math.min(1, 1600 / Math.max(target.width, target.height));
  canvas.width = Math.round(target.width * outScale);
  canvas.height = Math.round(target.height * outScale);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(el, input.crop.x * sx, input.crop.y * sy, input.crop.w * sx, input.crop.h * sy, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.9);
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** Exact fingerprint of the file the user picked (same file → same key). */
export async function fileFingerprint(file: Blob): Promise<string | null> {
  try {
    return 'f:' + hex(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()));
  } catch {
    return null;
  }
}

/**
 * Visual fingerprint: the photo shrunk to 24×24 greyscale, coarsely quantised, then hashed.
 * Catches the same photo re-picked from the library even if iOS re-encodes it (different bytes).
 */
export async function visualFingerprint(dataUrl: string): Promise<string | null> {
  try {
    const el = await loadImg(dataUrl);
    const N = 24;
    const c = document.createElement('canvas');
    c.width = N;
    c.height = N;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(el, 0, 0, N, N);
    const px = ctx.getImageData(0, 0, N, N).data;
    let q = `${el.naturalWidth}x${el.naturalHeight}:`;
    for (let i = 0; i < px.length; i += 4) q += Math.round((0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 32).toString(16);
    return 'v:' + hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(q)));
  } catch {
    return null;
  }
}
