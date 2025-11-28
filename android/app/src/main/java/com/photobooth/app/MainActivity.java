package com.photobooth.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.photobooth.app.uvc.UvcCameraPlugin;
import com.photobooth.app.print.PhotoPrintPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(UvcCameraPlugin.class);
        registerPlugin(PhotoPrintPlugin.class);
        super.onCreate(savedInstanceState);
    }
}