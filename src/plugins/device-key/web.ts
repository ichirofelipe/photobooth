export class DeviceKeyWeb {
    async getDeviceId() {
        console.warn("getDeviceId not available on web.");
        return { success: false };
    }
    async isActivated() {
        console.warn("isActivated not available on web.");
        return { success: false };
    }

    async validateKey() {
        console.warn("validateKey not available on web.");
        return { success: false };
    }
}