import { registerPlugin } from '@capacitor/core';

export const UvcCameraPlugin = registerPlugin('UvcCameraPlugin', {
  web: () => ({
    async listUvcDevices() {
      console.warn('UvcCameraPlugin not implemented on web');
      return { devices: [] };
    },
    async startPreview() {
      console.warn('startPreview not implemented on web');
      return { requested: false };
    },
    async stopPreview() {
      console.warn('UvcCameraPlugin not implemented on web');
      return { stopped: true };
    },
    // addListener() {
    //   console.warn('addListener not implemented on web');
    //   return { remove() {} };
    // },
  }),
});