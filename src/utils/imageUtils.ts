type DecodedImage = {
  source: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
  cleanup?: () => void;
};

export type PngImageData = {
  dataUrl: string;
  width: number;
  height: number;
};

function loadImageElement(src: string, revokeObjectUrl = false): Promise<DecodedImage> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';

    image.onload = () => {
      resolve({
        source: image,
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
        cleanup: revokeObjectUrl ? () => URL.revokeObjectURL(src) : undefined,
      });
    };

    image.onerror = () => {
      if (revokeObjectUrl) URL.revokeObjectURL(src);
      reject(new Error('No se pudo cargar la imagen'));
    };

    image.src = src;
  });
}

async function decodeBlobImage(blob: Blob): Promise<DecodedImage> {
  if ('createImageBitmap' in window) {
    try {
      const imageBitmap = await createImageBitmap(blob);
      return {
        source: imageBitmap,
        width: imageBitmap.width,
        height: imageBitmap.height,
        cleanup: () => imageBitmap.close(),
      };
    } catch {
      // Some browsers are picky with WEBP via createImageBitmap, so fall back to <img>.
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  return loadImageElement(objectUrl, true);
}

/**
 * Loads a remote product image, decodes formats such as WEBP, and exports it as
 * a PNG data URL that ExcelJS can embed reliably.
 */
export async function urlToPngDataUrl(url: string): Promise<PngImageData> {
  let decodedImage: DecodedImage;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`No se pudo descargar la imagen: ${response.status} ${response.statusText}`);
    }

    decodedImage = await decodeBlobImage(await response.blob());
  } catch {
    decodedImage = await loadImageElement(url);
  }

  try {
    const width = Math.max(1, decodedImage.width);
    const height = Math.max(1, decodedImage.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('No se pudo crear el contexto 2D para convertir la imagen');
    }

    context.drawImage(decodedImage.source, 0, 0, width, height);

    return {
      dataUrl: canvas.toDataURL('image/png'),
      width,
      height,
    };
  } finally {
    decodedImage.cleanup?.();
  }
}
