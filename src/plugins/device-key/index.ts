import { registerPlugin } from '@capacitor/core';
import type { DeviceKeyPlugin } from '@/types';

export const DeviceKey = registerPlugin<DeviceKeyPlugin>('DeviceKey', {
  web: () => import('./web').then((m) => new m.DeviceKeyWeb()),
});