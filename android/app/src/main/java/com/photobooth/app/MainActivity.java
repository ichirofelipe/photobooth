package com.photobooth.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.photobooth.app.uvc.UvcCameraPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        registerPlugin(UvcCameraPlugin.class);
    }
}