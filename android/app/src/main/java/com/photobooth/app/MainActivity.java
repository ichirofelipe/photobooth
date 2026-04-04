package com.photobooth.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.photobooth.app.devkey.DeviceKeyPlugin;
import com.photobooth.app.uvc.UvcCameraPlugin;
import com.photobooth.app.print.PhotoPrintPlugin;
import com.photobooth.app.photoserver.PhotoServerPlugin;

public class MainActivity extends BridgeActivity {

    private static final int PERMISSION_REQUEST_CODE = 2001;

    @Override
    protected void onCreate(Bundle savedInstanceState) {

        // Register your plugins BEFORE super.onCreate()
        registerPlugin(UvcCameraPlugin.class);
        registerPlugin(PhotoPrintPlugin.class);
        registerPlugin(DeviceKeyPlugin.class);
        registerPlugin(PhotoServerPlugin.class);

        super.onCreate(savedInstanceState);

        requestAppPermissions();
    }

    private void requestAppPermissions() {
        java.util.List<String> needed = new java.util.ArrayList<>();

        // Camera permission — required for internal camera fallback
        if (checkSelfPermission(Manifest.permission.CAMERA)
                != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.CAMERA);
        }

        // Notification permission — needed for USB permission dialog on Android 13+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                needed.add(Manifest.permission.POST_NOTIFICATIONS);
            }
        }

        if (!needed.isEmpty()) {
            requestPermissions(needed.toArray(new String[0]), PERMISSION_REQUEST_CODE);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == PERMISSION_REQUEST_CODE) {
            for (int i = 0; i < permissions.length; i++) {
                String perm = permissions[i];
                boolean granted = grantResults[i] == PackageManager.PERMISSION_GRANTED;
                android.util.Log.d("Permissions", perm + " granted=" + granted);

                // If camera was denied and user hasn't permanently dismissed, re-ask
                if (!granted && Manifest.permission.CAMERA.equals(perm)) {
                    if (shouldShowRequestPermissionRationale(Manifest.permission.CAMERA)) {
                        android.util.Log.w("Permissions",
                            "Camera permission denied but rationale available. User can retry.");
                    } else {
                        android.util.Log.w("Permissions",
                            "Camera permission permanently denied. User must enable in Settings.");
                    }
                }
            }
        }
    }
}
