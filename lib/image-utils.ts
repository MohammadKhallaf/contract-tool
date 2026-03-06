/**
 * Compress a base64 data URL or File to a JPEG data URL.
 * Resizes to maxSize px on the longest side and applies the given quality.
 */
export async function compressDataUrl(
  dataUrl: string,
  maxSize = 1024,
  quality = 0.7
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Compress a File object to a JPEG data URL.
 */
export async function compressFile(
  file: File,
  maxSize = 1024,
  quality = 0.7
): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    return await compressDataUrl(url, maxSize, quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}
