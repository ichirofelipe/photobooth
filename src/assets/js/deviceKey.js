import { DeviceKey } from '@/plugins/device-key';
import { ref } from 'vue';

export default function useDeviceKey() {
    // Device key logic here
    const isActivate = ref(false);
    const deviceId = ref();
    const errors = ref({
        licenseKey: null
    });

    const validateKey = async (key) => {
        const result = await DeviceKey.validateKey({key: key});
        isActivate.value = result.valid;
        
        if(!result.valid)
        {
            errors.value.licenseKey = "Invalid license key.";
        }
        else
        {
            alert("Activated successfully!");
        }
    }

    const checkActivation = async () => {
        if(Capacitor.getPlatform() === 'web')
        {
            isActivate.value = true;
            return;
        }

        await DeviceKey.isActivated().then((result) => {
            console.log("Activation status:", result);
            isActivate.value = result.activated;
        });
    }

    const fetchDeviceId = async () => {
        await DeviceKey.getDeviceId().then((result) => {
            console.log("Device ID:", result);
            deviceId.value = result.deviceId;
        });
    }

    return {
        isActivate,
        deviceId,
        validateKey,
        checkActivation,
        fetchDeviceId,
        errors
    };
}