import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';

export class FilesystemService {
  static async readJsonFile<T>(fileName: string): Promise<T> {
    const result = await Filesystem.readFile({
      path: fileName,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    return JSON.parse(result.data as string) as T;
  }

  static async writeJsonFile<T>(fileName: string, data: T): Promise<void> {
    await Filesystem.writeFile({
      path: fileName,
      data: JSON.stringify(data, null, 4),
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
  }

  static async deleteJsonFile(fileName: string): Promise<void> {
    await Filesystem.deleteFile({
      path: fileName,
      directory: Directory.Data,
    });
  }

  static async readBinaryFile(filePath: string): Promise<string> {
    const result = await Filesystem.readFile({
      path: filePath,
      directory: Directory.Data,
    });
    return result.data as string;
  }

  static async writeBinaryFile(filePath: string, base64Data: string): Promise<void> {
    await Filesystem.writeFile({
      path: filePath,
      data: base64Data,
      directory: Directory.Data,
      recursive: true,
    });
  }

  static async writeToDocuments(filePath: string, base64Data: string): Promise<void> {
    await Filesystem.writeFile({
      path: filePath,
      data: base64Data,
      directory: Directory.Documents,
    });
  }

  static async listDirectory(path: string = ''): Promise<{ name: string; type: string }[]> {
    const { files } = await Filesystem.readdir({
      path,
      directory: Directory.Data,
    });
    return files as { name: string; type: string }[];
  }

  static async loadOrInitJson<T>(fileName: string, defaultData: T): Promise<T> {
    try {
      return await FilesystemService.readJsonFile<T>(fileName);
    } catch {
      await FilesystemService.writeJsonFile(fileName, defaultData);
      return JSON.parse(JSON.stringify(defaultData)) as T;
    }
  }
}
