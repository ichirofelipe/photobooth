import { Capacitor } from '@capacitor/core';
import { UvcCameraPlugin } from '@/plugins/UvcCameraPlugin';

export default function usePermissions() {
  const requestAllPermissions = async (): Promise<void> => {
    if (Capacitor.getPlatform() === 'web') return;

    // USB permission is handled via the native plugin — request early
    // so the device prompt appears before the user reaches the camera page.
    // Camera permission is requested by MainActivity.onCreate() on the Android side.
    await requestUsbPermission();
  };

  const requestUsbPermission = async (): Promise<void> => {
    try {
      await UvcCameraPlugin.requestUsbPermissionEarly();
    } catch (err) {
      // No USB video device connected — this is expected if using internal camera
      console.warn('USB permission request skipped:', err);
    }
  };

  return { requestAllPermissions };
}
