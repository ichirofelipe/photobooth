import { registerPlugin } from '@capacitor/core';

export const UvcCameraPlugin = registerPlugin('UvcCameraPlugin', {
  web: () => ({
    listUvcDevices: async () => {
      console.warn('UvcCameraPlugin not implemented on web');
      return { devices: [] };
    },
    addListener: () => {
      console.warn('addListener not implemented on web');
    },
  }),
});