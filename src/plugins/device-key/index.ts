import { registerPlugin } from '@capacitor/core';

export const DeviceKey = registerPlugin('DeviceKey', {
    web: () => import('./web').then(m => new m.DeviceKeyWeb())
});