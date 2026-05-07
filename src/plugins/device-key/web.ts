import type {
  ActivationTarget,
  EntitlementRecord,
  EntitlementRevocation,
  EntitlementSyncItem,
  Feature,
} from '@/types';

/**
 * Web stub - all real work is done by the Android native plugin.
 * On web/dev the entitlement store bypasses this entirely via the
 * VITE_MOCK_ENTITLEMENTS flag.
 */
export class DeviceKeyWeb {
  async getDeviceId(): Promise<{ deviceId: string }> {
    console.warn('DeviceKey.getDeviceId() not available on web.');
    return { deviceId: 'web-stub-device' };
  }

  async getEntitlements(_opts: { publicKey: string }): Promise<{ entitlements: EntitlementRecord[] }> {
    console.warn('DeviceKey.getEntitlements() not available on web.');
    return { entitlements: [] };
  }

  async activateLicense(_opts: {
    key: string;
    feature: ActivationTarget;
    serverUrl: string;
    publicKey: string;
  }): Promise<{ transferred?: boolean; activatedFeatures?: Feature[] }> {
    console.warn('DeviceKey.activateLicense() not available on web.');
    return {};
  }

  async syncEntitlements(_opts: {
    serverUrl: string;
    entitlements: EntitlementSyncItem[];
    publicKey: string;
  }): Promise<{ revoked: EntitlementRevocation[] }> {
    console.warn('DeviceKey.syncEntitlements() not available on web.');
    return { revoked: [] };
  }
}
