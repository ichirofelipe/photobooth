import { ref, type Ref } from 'vue';
import { Capacitor } from '@capacitor/core';
import { DeviceKey } from '@/plugins/device-key';
import type { DeviceKeyErrors } from '@/types';

interface DeviceKeyReturn {
  isActivate: Ref<boolean>;
  deviceId: Ref<string | undefined>;
  validateKey: (key: string) => Promise<void>;
  checkActivation: () => Promise<void>;
  fetchDeviceId: () => Promise<void>;
  errors: Ref<DeviceKeyErrors>;
}

export default function useDeviceKey(): DeviceKeyReturn {
  const isActivate = ref(false);
  const deviceId = ref<string | undefined>();
  const errors = ref<DeviceKeyErrors>({ licenseKey: null });

  const validateKey = async (key: string): Promise<void> => {
    const result = await DeviceKey.validateKey({ key });
    isActivate.value = result.valid;

    if (!result.valid) {
      errors.value.licenseKey = 'Invalid license key.';
    } else {
      alert('Activated successfully!');
    }
  };

  const checkActivation = async (): Promise<void> => {
    if (Capacitor.getPlatform() === 'web') {
      isActivate.value = true;
      return;
    }

    const result = await DeviceKey.isActivated();
    isActivate.value = result.activated;
  };

  const fetchDeviceId = async (): Promise<void> => {
    const result = await DeviceKey.getDeviceId();
    deviceId.value = result.deviceId;
  };

  return {
    isActivate,
    deviceId,
    validateKey,
    checkActivation,
    fetchDeviceId,
    errors,
  };
}
