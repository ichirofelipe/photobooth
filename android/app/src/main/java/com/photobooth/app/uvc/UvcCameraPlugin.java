package com.photobooth.app.uvc;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@CapacitorPlugin(name = "UvcCameraPlugin")
public class UvcCameraPlugin extends Plugin {

    private static final String ACTION_USB_PERMISSION = "com.photobooth.app.USB_PERMISSION";

    @Override
    protected void handleOnStart() {
        super.handleOnStart();
        Log.d("UVC", "UvcCameraPlugin is loaded and ready");
    }

    private BroadcastReceiver usbReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (ACTION_USB_PERMISSION.equals(intent.getAction())) {
                UsbDevice device = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
                boolean granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);

                JSObject ret = new JSObject();
                ret.put("deviceName", device != null ? device.getDeviceName() : null);
                ret.put("granted", granted);
                notifyListeners("usbPermission", ret);

                Log.d("UVC", "Permission " + (granted ? "granted" : "denied") + " for " + (device != null ? device.getDeviceName() : "null"));
            }
        }
    };

    @PluginMethod
    public void listUvcDevices(PluginCall call) {
        UsbManager usbManager = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
        List<Map<String, Object>> jsonDevices = new ArrayList<>();

        for (UsbDevice device : usbManager.getDeviceList().values()) {
            boolean hasVideoInterface = false;
            for (int i = 0; i < device.getInterfaceCount(); i++) {
                if (device.getInterface(i).getInterfaceClass() == UsbConstants.USB_CLASS_VIDEO) {
                    hasVideoInterface = true;
                    break;
                }
            }

            if (hasVideoInterface) {
                Map<String, Object> d = new HashMap<>();
                d.put("name", device.getDeviceName());
                d.put("vendorId", device.getVendorId());
                d.put("productId", device.getProductId());
                jsonDevices.add(d);

                if (!usbManager.hasPermission(device)) {
                    int flag = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0;
                    PendingIntent permissionIntent = PendingIntent.getBroadcast(getContext(), 0,
                            new Intent(ACTION_USB_PERMISSION), flag);
                    getContext().registerReceiver(usbReceiver, new IntentFilter(ACTION_USB_PERMISSION));
                    usbManager.requestPermission(device, permissionIntent);
                }
            }
        }

        JSObject result = new JSObject();
        result.put("devices", jsonDevices);
        call.resolve(result);
    }
}
