export class ImageCompressorService {
  /**
   * Compresses a base64 PNG image to JPEG with reduced dimensions.
   * Returns a compressed base64 string (without data URI prefix).
   */
  static async compressBase64Image(
    base64: string,
    options: { maxWidth?: number; maxHeight?: number; quality?: number } = {}
  ): Promise<string> {
    const { maxWidth = 1200, maxHeight = 1200, quality = 0.7 } = options;

    const img = await ImageCompressorService.loadImage(
      base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`
    );

    const { width, height } = ImageCompressorService.calculateDimensions(
      img.width,
      img.height,
      maxWidth,
      maxHeight
    );

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    return dataUrl.replace('data:image/jpeg;base64,', '');
  }

  private static loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  private static calculateDimensions(
    srcWidth: number,
    srcHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    if (srcWidth <= maxWidth && srcHeight <= maxHeight) {
      return { width: srcWidth, height: srcHeight };
    }

    const ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);
    return {
      width: Math.round(srcWidth * ratio),
      height: Math.round(srcHeight * ratio),
    };
  }
}
