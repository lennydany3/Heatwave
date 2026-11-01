// Client-side image compression for the payment screenshot. Phone screenshots are
// often 2–8 MB; resizing and re-encoding them as JPEG typically brings them to
// 100–400 KB, which means faster uploads and far less storage for us to keep.
//
// Runs in the browser only (canvas + createImageBitmap).

const DECODABLE = ["image/png", "image/jpeg", "image/webp"];

export type Compressed = { file: File; originalBytes: number; compressed: boolean };

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

async function encode(bitmap: ImageBitmap, maxEdge: number, quality: number): Promise<Blob | null> {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  // JPEG has no transparency: paint white first so transparent PNGs don't turn black.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await toBlob(canvas, quality);
  // Release the canvas backing store right away instead of waiting for GC.
  canvas.width = canvas.height = 0;
  return blob;
}

// Resizes to at most `maxEdge` px on the long side and re-encodes as JPEG. If the
// result is still big it is squeezed harder once. Falls back to the original file
// when the browser can't decode the image (e.g. HEIC in Chrome) or when
// compression wouldn't make it smaller.
export async function compressImage(
  file: File,
  { maxEdge = 1600, quality = 0.82, targetBytes = 600 * 1024 } = {}
): Promise<Compressed> {
  const untouched = { file, originalBytes: file.size, compressed: false };
  if (!DECODABLE.includes(file.type) && !/^image\/(heic|heif)$/.test(file.type)) return untouched;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return untouched;
  }

  try {
    let blob = await encode(bitmap, maxEdge, quality);
    if (blob && blob.size > targetBytes) {
      const tighter = await encode(bitmap, Math.round(maxEdge * 0.8), quality - 0.17);
      if (tighter && tighter.size < blob.size) blob = tighter;
    }
    if (!blob || blob.size >= file.size) return untouched;

    const name = file.name.replace(/\.[^.]+$/, "") || "payment-proof";
    return {
      file: new File([blob], `${name}.jpg`, { type: "image/jpeg", lastModified: Date.now() }),
      originalBytes: file.size,
      compressed: true,
    };
  } finally {
    bitmap.close(); // free the decoded pixels
  }
}

export function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
