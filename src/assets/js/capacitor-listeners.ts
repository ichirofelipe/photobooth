import { App as CapApp } from '@capacitor/app';
import { UvcCameraPlugin } from '@/plugins/UvcCameraPlugin';
import { Capacitor } from '@capacitor/core';

export function registerCapacitorListeners(): void {
  if (Capacitor.getPlatform() === 'web') return;

  CapApp.addListener('appStateChange', async ({ isActive }) => {
    if (!isActive) return;

    console.log("[Capacitor] App returned to foreground");

    try {
      const { granted } = await UvcCameraPlugin.hasUsbPermission();
      if (!granted) {
        const res = await UvcCameraPlugin.requestUsbPermissionEarly();
        console.log("USB permission re-request:", res);
      }
    } catch (err) {
      console.log("USB foreground request failed:", err);
    }
  });
}
