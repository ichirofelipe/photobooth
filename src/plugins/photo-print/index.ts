import { registerPlugin } from '@capacitor/core';

export const PhotoPrint = registerPlugin('PhotoPrint', {
    web: () => import('./web').then(m => new m.PhotoPrintWeb())
});