package com.photobooth.app.devkey;

import android.content.Context;
import android.content.SharedPreferences;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DeviceKey")
public class DeviceKeyPlugin extends Plugin {

    @PluginMethod()
    public void getDeviceId(PluginCall call) {
        String androidId = Settings.Secure.getString(
                getContext().getContentResolver(),
                Settings.Secure.ANDROID_ID
        );
        JSObject ret = new JSObject();
        ret.put("deviceId", androidId);
        call.resolve(ret);
    }

    @PluginMethod()
    public void validateKey(PluginCall call) {
        String deviceId = Settings.Secure.getString(
                getContext().getContentResolver(),
                Settings.Secure.ANDROID_ID
        );

        String licenseKey = call.getString("key");

        if (licenseKey == null) {
            call.reject("License key is missing.");
            return;
        }

        boolean isValid = LicenseValidator.check(deviceId, licenseKey);

        JSObject ret = new JSObject();
        ret.put("valid", isValid);
        call.resolve(ret);

        if (isValid) {
            SharedPreferences prefs = getContext().getSharedPreferences("license", Context.MODE_PRIVATE);
            prefs.edit().putBoolean("activated", true).apply();
        }
    }

    @PluginMethod()
    public void isActivated(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences("license", Context.MODE_PRIVATE);
        boolean activated = prefs.getBoolean("activated", false);

        JSObject ret = new JSObject();
        ret.put("activated", activated);
        call.resolve(ret);
    }
}