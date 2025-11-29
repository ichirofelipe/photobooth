package com.photobooth.app;

import android.content.pm.PackageManager;
import android.os.Bundle;
import android.content.Intent;
import android.app.NotificationManager;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.BridgeActivity;
import com.photobooth.app.uvc.UvcCameraPlugin;
import com.photobooth.app.print.PhotoPrintPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(UvcCameraPlugin.class);
        registerPlugin(PhotoPrintPlugin.class);
        super.onCreate(savedInstanceState);

        // --- USB Permission Dialog Requires Notifications Enabled ---
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {

                requestPermissions(new String[]{
                        android.Manifest.permission.POST_NOTIFICATIONS
                }, 101);
            }
        }
    }
}
