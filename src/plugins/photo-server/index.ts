import { registerPlugin } from '@capacitor/core';

interface PhotoServerPlugin {
  startServer(options?: { port?: number }): Promise<{ started: boolean; url: string | null; ip: string; port: number }>;
  stopServer(): Promise<{ stopped: boolean }>;
  savePhoto(options: { base64: string }): Promise<{ downloadUrl: string; filename: string }>;
  getServerInfo(): Promise<{ running: boolean; ip: string; port: number; url: string | null }>;
}

export const PhotoServer = registerPlugin<PhotoServerPlugin>('PhotoServer', {
  web: () => import('./web').then(m => new m.PhotoServerWeb()),
});
