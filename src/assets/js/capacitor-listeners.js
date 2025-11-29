import { App as CapApp } from '@capacitor/app';
import { UvcCameraPlugin } from '@/plugins/UvcCameraPlugin';

export function registerCapacitorListeners() {
  CapApp.addListener('appStateChange', async ({ isActive }) => {
    if (!isActive) return;

    console.log("[Capacitor] App returned to foreground");

    try {
      const res = await UvcCameraPlugin.requestUsbPermissionEarly();
      console.log("USB permission request:", res);
    } catch (err) {
      console.log("USB early request failed:", err);
    }
  });
}
