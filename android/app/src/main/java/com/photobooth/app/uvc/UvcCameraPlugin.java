package com.photobooth.app.uvc;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.ImageFormat;
import android.graphics.Rect;
import android.graphics.YuvImage;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.jiangdg.ausbc.MultiCameraClient;
import com.jiangdg.ausbc.camera.CameraUVC;
import com.jiangdg.ausbc.camera.bean.CameraRequest;
import com.jiangdg.ausbc.callback.ICaptureCallBack;
import com.jiangdg.ausbc.callback.IDeviceConnectCallBack;
import com.jiangdg.ausbc.callback.IPreviewDataCallBack;
import com.jiangdg.usb.USBMonitor;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.lang.reflect.Constructor;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "UvcCameraPlugin")
public class UvcCameraPlugin extends Plugin {

    private static final String TAG = "UVC";
    private static final String ACTION_USB_PERMISSION = "com.photobooth.app.USB_PERMISSION";

    private PendingIntent usbPermissionIntent;

    private MultiCameraClient mClient = null;
    private MultiCameraClient.ICamera mCamera = null;

    private final ExecutorService compressExecutor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean compressRunning = new AtomicBoolean(false);
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private boolean clientRegistered = false;

    private int previewWidth = 640;
    private int previewHeight = 480;
    // default 0 = no throttle; you can override from JS via throttleMs
    private int previewThrottleMs = 0;
    private int previewJpegQuality = 70;

    // we only use single target camera (vendor/product)
    private Integer targetVendorId = null;
    private Integer targetProductId = null;

    private CameraRequest currentRequest = null;
    private IPreviewDataCallBack previewCb = null;

    // ---------------- USB PERMISSION RECEIVER (dynamic, exported) ----------------
    private final BroadcastReceiver usbReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context ctx, Intent intent) {

            Log.e(TAG, "USB PERMISSION BROADCAST RECEIVED");

            if (!ACTION_USB_PERMISSION.equals(intent.getAction())) return;

            UsbDevice device = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
            boolean granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);

            JSObject obj = new JSObject();
            obj.put("granted", granted);
            obj.put("deviceName", device != null ? device.getDeviceName() : null);
            notifyListeners("usbPermission", obj);

            if (granted && mClient != null && device != null && deviceMatches(device)) {
                Log.d(TAG, "USB permission granted, passing to AUSBC requestPermission()");
                try {
                    mClient.requestPermission(device);
                } catch (Throwable e) {
                    Log.e(TAG, "mClient.requestPermission failed", e);
                }
            } else {
                Log.w(TAG, "USB permission denied or device null/mismatch");
            }
        }
    };

    // ---------------- LIFECYCLE ----------------

    private void initUsbPermissionIntent() {
        if (usbPermissionIntent == null) {
            Intent intent = new Intent(ACTION_USB_PERMISSION);
            usbPermissionIntent = PendingIntent.getBroadcast(
                    getContext(),
                    0,
                    intent,
                    PendingIntent.FLAG_IMMUTABLE
            );
        }
    }

    @Override
    protected void handleOnStart() {
        super.handleOnStart();

        // Register USB permission receiver dynamically as EXPORTED
        try {
            IntentFilter filter = new IntentFilter(ACTION_USB_PERMISSION);
            Log.d(TAG, "Registering USB permission receiver (exported)");
            ContextCompat.registerReceiver(
                    getContext(),
                    usbReceiver,
                    filter,
                    ContextCompat.RECEIVER_EXPORTED
            );
        } catch (Exception e) {
            Log.e(TAG, "Receiver register failed: " + e.getMessage(), e);
        }
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        stopPreviewInternal();

        try {
            getContext().unregisterReceiver(usbReceiver);
        } catch (Exception ignore) {}

        try {
            compressExecutor.shutdownNow();
        } catch (Exception ignore) {}
    }

    // ---------------- Utility ----------------

    private boolean deviceMatches(UsbDevice d) {
        return d != null
                && targetVendorId != null
                && targetProductId != null
                && d.getVendorId() == targetVendorId
                && d.getProductId() == targetProductId;
    }

    // ---------------- JS API METHODS ----------------

    @PluginMethod
    public void requestUsbPermissionEarly(PluginCall call) {
        try {
            UsbManager manager = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
            if (manager == null) {
                call.reject("UsbManager not available");
                return;
            }

            UsbDevice target = null;
            for (UsbDevice d : manager.getDeviceList().values()) {
                boolean isVideo = false;
                for (int i = 0; i < d.getInterfaceCount(); i++) {
                    if (d.getInterface(i).getInterfaceClass() == UsbConstants.USB_CLASS_VIDEO) {
                        isVideo = true;
                        break;
                    }
                }
                if (isVideo) {
                    target = d;
                    break;
                }
            }

            if (target == null) {
                call.reject("No USB video device detected");
                return;
            }

            initUsbPermissionIntent();
            manager.requestPermission(target, usbPermissionIntent);

            JSObject res = new JSObject();
            res.put("requested", true);
            res.put("deviceName", target.getDeviceName());
            call.resolve(res);

        } catch (Exception e) {
            call.reject("requestUsbPermissionEarly failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void listUvcDevices(PluginCall call) {
        try {
            UsbManager usbManager = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
            if (usbManager == null) {
                call.reject("UsbManager not available");
                return;
            }

            List<JSObject> devices = new ArrayList<>();

            for (UsbDevice d : usbManager.getDeviceList().values()) {
                boolean isVideo = false;
                for (int i = 0; i < d.getInterfaceCount(); i++) {
                    if (d.getInterface(i).getInterfaceClass() == UsbConstants.USB_CLASS_VIDEO) {
                        isVideo = true;
                        break;
                    }
                }
                if (!isVideo) continue;

                JSObject dev = new JSObject();
                dev.put("name", d.getDeviceName());
                dev.put("vendorId", d.getVendorId());
                dev.put("productId", d.getProductId());
                devices.add(dev);
            }

            JSObject res = new JSObject();
            res.put("devices", devices);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("listUvcDevices failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void hasUsbPermission(PluginCall call) {
        UsbManager manager = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
        boolean granted = false;

        if (manager != null && targetVendorId != null && targetProductId != null) {
            for (UsbDevice d : manager.getDeviceList().values()) {
                if (d.getVendorId() == targetVendorId && d.getProductId() == targetProductId) {
                    granted = manager.hasPermission(d);
                    break;
                }
            }
        }

        JSObject res = new JSObject();
        res.put("granted", granted);
        call.resolve(res);
    }

    // ---------------- startPreview (single camera, base64-only, auto-reconnect) ----------------
    @PluginMethod
    public void startPreview(PluginCall call) {
        try {
            Integer vId = call.getInt("vendorId");
            Integer pId = call.getInt("productId");

            if (vId == null || pId == null) {
                call.reject("vendorId and productId are required");
                return;
            }

            targetVendorId = vId;
            targetProductId = pId;

            previewWidth = call.getInt("width", 640);
            previewHeight = call.getInt("height", 480);
            previewThrottleMs = call.getInt("throttleMs", 0); // 0 = no throttle
            previewJpegQuality = call.getInt("jpegQuality", 70);

            stopPreviewInternal();

            // Build CameraRequest
            currentRequest = new CameraRequest.Builder()
                    .setPreviewWidth(previewWidth)
                    .setPreviewHeight(previewHeight)
                    .setRenderMode(CameraRequest.RenderMode.NORMAL)
                    .setRawPreviewData(true)
                    .create();

            buildPreviewCallback();

            // Create MultiCameraClient if needed
            if (mClient == null) {
                mClient = new MultiCameraClient(getContext(), new IDeviceConnectCallBack() {

                    @Override
                    public void onAttachDev(UsbDevice device) {
                        String name = (device != null ? device.getDeviceName() : "null");
                        Log.d(TAG, "USB attached: " + name);

                        if (!deviceMatches(device)) {
                            Log.d(TAG, "onAttachDev: not target device, ignoring");
                            return;
                        }

                        UsbManager manager = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
                        if (manager == null) return;

                        if (manager.hasPermission(device)) {
                            Log.d(TAG, "Already have permission on attach; requesting AUSBC permission");
                            try {
                                mClient.requestPermission(device);
                            } catch (Throwable e) {
                                Log.e(TAG, "requestPermission on attach failed", e);
                            }
                        } else {
                            Log.d(TAG, "No permission on attach; requesting via PendingIntent");
                            initUsbPermissionIntent();
                            try {
                                manager.requestPermission(device, usbPermissionIntent);
                            } catch (Throwable e) {
                                Log.e(TAG, "requestPermission in onAttachDev failed", e);
                            }
                        }
                    }

                    @Override
                    public void onDetachDec(UsbDevice device) {
                        String name = (device != null ? device.getDeviceName() : "null");
                        Log.d(TAG, "USB detached: " + name);

                        if (!deviceMatches(device)) return;

                        mainHandler.post(() -> {
                            if (mCamera != null) {
                                try {
                                    mCamera.closeCamera();
                                } catch (Throwable ignore) {}
                                mCamera = null;
                            }
                        });
                    }

                    @Override
                    public void onConnectDev(UsbDevice device, USBMonitor.UsbControlBlock ctrlBlock) {
                        String name = (device != null ? device.getDeviceName() : "null");
                        Log.d(TAG, "onConnectDev: " + name);

                        mainHandler.post(() -> openCameraForDevice(device, ctrlBlock));
                    }

                    @Override
                    public void onDisConnectDec(UsbDevice device, USBMonitor.UsbControlBlock ctrlBlock) {
                        String name = (device != null ? device.getDeviceName() : "null");
                        Log.d(TAG, "onDisConnectDec: " + name);
                        if (!deviceMatches(device)) return;

                        mainHandler.post(() -> {
                            if (mCamera != null) {
                                try {
                                    mCamera.closeCamera();
                                } catch (Throwable ignore) {}
                                mCamera = null;
                            }
                        });
                    }

                    @Override
                    public void onCancelDev(UsbDevice device) {
                        String name = (device != null ? device.getDeviceName() : "null");
                        Log.d(TAG, "onCancelDev: " + name);
                    }
                });
            }

            // Register USB monitor (listen for attach/detach/connect)
            mClient.register();
            clientRegistered = true;

            // Find the matching USB device right now
            UsbManager manager = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
            if (manager == null) {
                call.reject("UsbManager not available");
                return;
            }

            UsbDevice matched = null;
            for (UsbDevice d : manager.getDeviceList().values()) {
                Log.d(TAG, "Found USB device: " + d.getDeviceName()
                        + " VID=" + d.getVendorId()
                        + " PID=" + d.getProductId()
                        + " hasPermission=" + manager.hasPermission(d));
                if (deviceMatches(d)) {
                    matched = d;
                    break;
                }
            }

            if (matched == null) {
                call.reject("No matching UVC device found");
                return;
            }

            // Always request permission via our immutable PendingIntent.
            Log.d(TAG, "Requesting USB permission for device: " + matched.getDeviceName());
            initUsbPermissionIntent();
            manager.requestPermission(matched, usbPermissionIntent);

            JSObject ok = new JSObject();
            ok.put("started", true);
            call.resolve(ok);

        } catch (Exception e) {
            Log.e(TAG, "startPreview failed", e);
            call.reject("startPreview failed: " + e.getMessage());
        }
    }

    // ---------------- preview callback builder (BASE64 ONLY) ----------------
    private void buildPreviewCallback() {
        previewCb = new IPreviewDataCallBack() {
            private long lastEmit = 0;

            @Override
            public void onPreviewData(byte[] data, int w, int h, DataFormat format) {
                if (data == null || data.length < 4) return;

                long now = System.currentTimeMillis();
                if (previewThrottleMs > 0 && now - lastEmit < previewThrottleMs) return;
                lastEmit = now;

                if (!compressRunning.compareAndSet(false, true)) return;

                compressExecutor.submit(() -> {
                    try {
                        JSObject payload = new JSObject();
                        payload.put("width", w);
                        payload.put("height", h);

                        boolean looksJpeg =
                                (data[0] & 0xFF) == 0xFF &&
                                        (data[1] & 0xFF) == 0xD8;

                        String base64;
                        if (looksJpeg) {
                            base64 = Base64.encodeToString(data, Base64.NO_WRAP);
                        } else {
                            base64 = encodeYuvToBase64(data, w, h);
                        }
                        payload.put("data", base64);

                        mainHandler.post(() -> notifyListeners("frame", payload));
                    } catch (Throwable e) {
                        Log.e(TAG, "Error in preview compression", e);
                    } finally {
                        compressRunning.set(false);
                    }
                });
            }
        };
    }

    private String encodeYuvToBase64(byte[] data, int w, int h) {
        try {
            YuvImage yuv = new YuvImage(data, ImageFormat.NV21, w, h, null);
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            yuv.compressToJpeg(new Rect(0, 0, w, h), previewJpegQuality, baos);
            String base64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);
            baos.close();
            return base64;
        } catch (Throwable e) {
            Log.e(TAG, "encodeYuvToBase64 failed", e);
            return "";
        }
    }

    // ---------------- CAMERA OPEN ----------------
    private void openCameraForDevice(UsbDevice device, USBMonitor.UsbControlBlock ctrlBlock) {
        try {
            if (!deviceMatches(device)) {
                Log.d(TAG, "openCameraForDevice: skipping non-target device");
                return;
            }

            if (mCamera != null) {
                try {
                    mCamera.closeCamera();
                } catch (Throwable ignore) {}
                mCamera = null;
            }

            mCamera = createCameraUvcInstance(device);
            if (mCamera == null) {
                Log.e(TAG, "Failed to create CameraUVC instance");
                return;
            }

            mCamera.addPreviewDataCallBack(previewCb);
            mCamera.setUsbControlBlock(ctrlBlock);
            mCamera.openCamera(null, currentRequest);

        } catch (Throwable e) {
            Log.e(TAG, "openCamera failed: ", e);
        }
    }

    // ---------------- stopPreview ----------------
    @PluginMethod
    public void stopPreview(PluginCall call) {
        stopPreviewInternal();
        JSObject res = new JSObject();
        res.put("stopped", true);
        call.resolve(res);
    }

    private void stopPreviewInternal() {
        try {
            if (mCamera != null) {
                try {
                    mCamera.closeCamera();
                } catch (Throwable ignore) {}
                mCamera = null;
            }
            if (mClient != null) {
                try {
                    if (clientRegistered) {
                        mClient.unRegister();
                    }
                    mClient.destroy();
                } catch (Throwable ignore) {}
                mClient = null;
                clientRegistered = false;
            }
        } catch (Throwable ignore) {}
    }

    // ---------------- CAMERA CREATION ----------------
    private MultiCameraClient.ICamera createCameraUvcInstance(UsbDevice dev) {
        try {
            Constructor<CameraUVC> c = CameraUVC.class.getConstructor(Context.class, UsbDevice.class);
            return c.newInstance(getContext(), dev);
        } catch (Exception e) {
            Log.e(TAG, "createCameraUvcInstance failed", e);
        }
        return null;
    }

    // ---------------- captureSnapshot (kept; file or base64) ----------------
    @PluginMethod
    public void captureSnapshot(final PluginCall call) {
        try {
            if (mCamera == null || !mCamera.isCameraOpened()) {
                call.reject("Camera not opened");
                return;
            }

            final String mode = call.getString("mode") == null ? "file" : call.getString("mode");
            Integer q = call.getInt("jpegQuality");
            final int jpegQuality = (q == null) ? 70 : q;
            Integer t = call.getInt("timeoutMs");
            final int timeoutMs = (t == null) ? 3000 : t;

            final AtomicBoolean finished = new AtomicBoolean(false);

            final IPreviewDataCallBack oneShot = new IPreviewDataCallBack() {
                @Override
                public void onPreviewData(final byte[] data, final int width, final int height, IPreviewDataCallBack.DataFormat format) {
                    try {
                        if (finished.getAndSet(true)) return;

                        try { mCamera.removePreviewDataCallBack(this); } catch (Throwable ignored) {}

                        compressExecutor.submit(() -> {
                            try {
                                boolean looksJpeg = data != null && data.length > 2 &&
                                        (data[0] & 0xFF) == 0xFF &&
                                        (data[1] & 0xFF) == 0xD8;

                                JSObject res = new JSObject();
                                res.put("width", width);
                                res.put("height", height);

                                if ("file".equalsIgnoreCase(mode)) {
                                    byte[] jpegBytes;
                                    if (looksJpeg) {
                                        jpegBytes = data;
                                    } else {
                                        YuvImage yuv = new YuvImage(data, ImageFormat.NV21, width, height, null);
                                        ByteArrayOutputStream baos = new ByteArrayOutputStream();
                                        yuv.compressToJpeg(new Rect(0, 0, width, height), jpegQuality, baos);
                                        jpegBytes = baos.toByteArray();
                                        try { baos.close(); } catch (Exception ignore) {}
                                    }
                                    File outDir = new File(getContext().getCacheDir(), "uvc_snapshots");
                                    if (!outDir.exists()) outDir.mkdirs();
                                    File out = new File(outDir, "uvc_snapshot_" + System.currentTimeMillis() + ".jpg");
                                    try (FileOutputStream fos = new FileOutputStream(out)) {
                                        fos.write(jpegBytes);
                                        fos.flush();
                                    }
                                    res.put("file", "file://" + out.getAbsolutePath());
                                    mainHandler.post(() -> call.resolve(res));
                                } else {
                                    // base64 mode
                                    if (looksJpeg) {
                                        res.put("data", Base64.encodeToString(data, Base64.NO_WRAP));
                                    } else {
                                        YuvImage yuv = new YuvImage(data, ImageFormat.NV21, width, height, null);
                                        ByteArrayOutputStream baos = new ByteArrayOutputStream();
                                        yuv.compressToJpeg(new Rect(0, 0, width, height), jpegQuality, baos);
                                        res.put("data", Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP));
                                        try { baos.close(); } catch (Exception ignore) {}
                                    }
                                    mainHandler.post(() -> call.resolve(res));
                                }
                            } catch (Throwable ex) {
                                mainHandler.post(() -> call.reject("captureSnapshot failed: " + ex.getMessage()));
                            }
                        });

                    } catch (Throwable ex) {
                        if (finished.compareAndSet(false, true)) call.reject("captureSnapshot failed: " + ex.getMessage());
                    }
                }
            };

            mCamera.addPreviewDataCallBack(oneShot);

            mainHandler.postDelayed(() -> {
                if (finished.compareAndSet(false, true)) {
                    try { mCamera.removePreviewDataCallBack(oneShot); } catch (Throwable ignored) {}
                    call.reject("captureSnapshot timed out");
                }
            }, timeoutMs);

        } catch (Exception e) {
            call.reject("captureSnapshot failed: " + e.getMessage());
        }
    }

    // ---------------- capturePhoto (kept; captureImage + fallback to snapshot) ----------------
    @PluginMethod
    public void capturePhoto(final PluginCall call) {
        try {
            if (mCamera == null || !mCamera.isCameraOpened()) {
                call.reject("Camera not opened");
                return;
            }

            File outDir;
            try {
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                    outDir = getContext().getExternalFilesDir(null);
                    if (outDir == null) outDir = getContext().getFilesDir();
                } else {
                    boolean hasPerm = true;
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                        hasPerm = (getContext().checkSelfPermission(android.Manifest.permission.WRITE_EXTERNAL_STORAGE)
                                == android.content.pm.PackageManager.PERMISSION_GRANTED);
                    }
                    outDir = hasPerm ? getContext().getExternalFilesDir(null) : getContext().getCacheDir();
                    if (outDir == null) outDir = getContext().getCacheDir();
                }
            } catch (Throwable ex) {
                outDir = getContext().getCacheDir();
            }
            if (!outDir.exists()) outDir.mkdirs();
            final String outPath = new File(outDir, "uvc_photo_" + System.currentTimeMillis() + ".jpg").getAbsolutePath();

            final AtomicBoolean finished = new AtomicBoolean(false);

            try {
                mCamera.captureImage(new ICaptureCallBack() {
                    @Override
                    public void onBegin() {
                        JSObject ev = new JSObject();
                        ev.put("status", "begin");
                        notifyListeners("capture", ev);
                    }

                    @Override
                    public void onError(String error) {
                        if (!finished.compareAndSet(false, true)) return;
                        String errLower = (error == null) ? "" : error.toLowerCase();
                        if (errLower.contains("permission") || errLower.contains("storage")) {
                            Log.w(TAG, "captureImage failed due to storage permission; falling back to captureSnapshot()");
                            try {
                                captureSnapshot(call);
                            } catch (Throwable t) {
                                call.reject("capturePhoto fallback failed: " + t.getMessage());
                            }
                        } else {
                            call.reject("capturePhoto error: " + (error == null ? "unknown" : error));
                        }
                    }

                    @Override
                    public void onComplete(String path) {
                        if (!finished.compareAndSet(false, true)) return;
                        JSObject res = new JSObject();
                        String finalPath = (path != null && path.startsWith("/")) ? path : outPath;
                        res.put("file", "file://" + finalPath);
                        call.resolve(res);
                    }
                }, outPath);
            } catch (Throwable e) {
                if (finished.compareAndSet(false, true)) {
                    Log.w(TAG, "captureImage threw, falling back to captureSnapshot(): " + e.getMessage(), e);
                    try {
                        captureSnapshot(call);
                    } catch (Throwable t) {
                        call.reject("capturePhoto failed: " + t.getMessage());
                    }
                }
            }

        } catch (Exception e) {
            call.reject("capturePhoto failed: " + e.getMessage());
        }
    }
}
