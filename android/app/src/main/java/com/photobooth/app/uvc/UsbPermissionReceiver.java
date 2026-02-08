package com.photobooth.app.uvc;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.util.Log;

public class UsbPermissionReceiver extends BroadcastReceiver {

    private static final String TAG = "UVC";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;

        String action = intent.getAction();
        if (!UvcCameraPlugin.ACTION_USB_PERMISSION.equals(action)) {
            return;
        }

        UsbDevice device = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
        boolean granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);

        Log.d(TAG, "UsbPermissionReceiver: granted=" + granted +
                " device=" + (device != null ? device.getDeviceName() : "null"));

        UvcCameraPlugin plugin = UvcCameraPlugin.getInstance();
        if (plugin != null) {
            plugin.handleUsbPermissionResult(device, granted);
        } else {
            Log.w(TAG, "UsbPermissionReceiver: plugin instance is null");
        }
    }
}
