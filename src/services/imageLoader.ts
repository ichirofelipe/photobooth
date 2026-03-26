import { FilesystemService } from './filesystem';

export class ImageLoaderService {
  static loadImageFromUrl(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  static getMimeType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    if (ext === 'svg') return 'image/svg+xml';
    return 'image/png';
  }

  static async loadImageFromFilesystem(filePath: string): Promise<HTMLImageElement> {
    const base64 = await FilesystemService.readBinaryFile(filePath);
    const mime = ImageLoaderService.getMimeType(filePath);
    const imgSrc = `data:${mime};base64,${base64}`;
    return ImageLoaderService.loadImageFromUrl(imgSrc);
  }

  static async loadImageWithFallback(
    url: string,
    fallbackPath?: string
  ): Promise<HTMLImageElement | null> {
    try {
      return await ImageLoaderService.loadImageFromUrl(url);
    } catch {
      if (fallbackPath) {
        try {
          return await ImageLoaderService.loadImageFromFilesystem(fallbackPath);
        } catch {
          console.error(`Cannot load image: ${url} / ${fallbackPath}`);
          return null;
        }
      }
      return null;
    }
  }

  static readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });
  }
}
