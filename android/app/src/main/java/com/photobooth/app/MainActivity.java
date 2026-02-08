package com.photobooth.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.photobooth.app.devkey.DeviceKeyPlugin;
import com.photobooth.app.uvc.UvcCameraPlugin;
import com.photobooth.app.print.PhotoPrintPlugin;

public class MainActivity extends BridgeActivity {

    private static final int CAMERA_PERMISSION_REQUEST = 2001;

    @Override
    protected void onCreate(Bundle savedInstanceState) {

        // Register your plugins BEFORE super.onCreate()
        registerPlugin(UvcCameraPlugin.class);
        registerPlugin(PhotoPrintPlugin.class);
        registerPlugin(DeviceKeyPlugin.class);

        super.onCreate(savedInstanceState);

        // --- Notification permission for USB permission dialog on Android 13+ ---
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {

                requestPermissions(
                        new String[]{ android.Manifest.permission.POST_NOTIFICATIONS },
                        101
                );
            }
        }
    }

    @Override
    public void onStart() {
        super.onStart();

        // Request CAMERA permission here
        if (checkSelfPermission(android.Manifest.permission.CAMERA)
                != PackageManager.PERMISSION_GRANTED) {

            requestPermissions(
                    new String[]{android.Manifest.permission.CAMERA},
                    2001
            );
        }
    }
}
