package com.photobooth.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.photobooth.app.uvc.UvcCameraPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(UvcCameraPlugin.class);
        super.onCreate(savedInstanceState);
    }
}