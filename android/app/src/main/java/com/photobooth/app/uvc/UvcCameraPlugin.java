package com.photobooth.app.uvc;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.ImageFormat;
import android.graphics.Matrix;
import android.graphics.Rect;
import android.graphics.YuvImage;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;

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
import java.lang.reflect.Constructor;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "UvcCameraPlugin")
public class UvcCameraPlugin extends Plugin {

    private static final String TAG = "UVC";
    public static final String ACTION_USB_PERMISSION = "com.photobooth.app.USB_PERMISSION";

    // Static instance so the BroadcastReceiver can call back into the plugin
    private static UvcCameraPlugin instance;

    public static UvcCameraPlugin getInstance() {
        return instance;
    }

    private PendingIntent usbPermissionIntent;

    private MultiCameraClient mClient = null;
    private MultiCameraClient.ICamera mCamera = null;

    private final ExecutorService compressExecutor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean compressRunning = new AtomicBoolean(false);
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private boolean clientRegistered = false;

    private int previewWidth = 1280;
    private int previewHeight = 720;
    private int previewThrottleMs = 50;
    private int previewJpegQuality = 70;

    // We track the "chosen" device by VID/PID
    private Integer targetVendorId = null;
    private Integer targetProductId = null;

    private CameraRequest currentRequest = null;
    private IPreviewDataCallBack previewCb = null;

    private enum SourceMode {
        UVC,
        INTERNAL
    }

    private InternalCamera internalCamera = null;
    private SourceMode currentSource = SourceMode.UVC;

    // ---------------- LIFECYCLE ----------------

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        stopPreviewInternal();
        try {
            compressExecutor.shutdownNow();
        } catch (Exception ignore) {}

        if (instance == this) {
            instance = null;
        }
    }

    private void initUsbPermissionIntent() {
        if (usbPermissionIntent == null) {
            Context ctx = getContext();

            Intent intent = new Intent(ctx, UsbPermissionReceiver.class);
            intent.setAction(ACTION_USB_PERMISSION); // explicit action
            intent.setPackage(ctx.getPackageName()); // CRITICAL on Android 12+

            usbPermissionIntent = PendingIntent.getBroadcast(
                    ctx,
                    0,
                    intent,
                    PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
            );
        }
    }


    // ---------------- Utility ----------------

    private boolean deviceMatches(UsbDevice d) {
        return d != null
                && targetVendorId != null
                && targetProductId != null
                && d.getVendorId() == targetVendorId
                && d.getProductId() == targetProductId;
    }

    // Called from UsbPermissionReceiver
    public void handleUsbPermissionResult(UsbDevice device, boolean granted) {
        Log.d(TAG, "USB Permission result. granted=" + granted +
                " device=" + (device != null ? device.getDeviceName() : "null"));

        UsbManager manager = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);

        // 💡 Fallback: if broadcast says "denied/null" but we actually HAVE permission, trust hasPermission().
        if ((!granted || device == null) && manager != null
                && targetVendorId != null && targetProductId != null) {

            for (UsbDevice d : manager.getDeviceList().values()) {
                if (deviceMatches(d) && manager.hasPermission(d)) {
                    Log.w(TAG, "Broadcast said denied/null but hasPermission() is true. Trusting manager and continuing.");
                    if (mClient != null) {
                        try {
                            mClient.requestPermission(d);
                        } catch (Throwable e) {
                            Log.e(TAG, "mClient.requestPermission in fallback failed", e);
                        }
                    } else {
                        Log.w(TAG, "mClient is null in fallback handleUsbPermissionResult");
                    }
                    return; // we handled it
                }
            }

            Log.w(TAG, "USB permission denied or device null, and no matching hasPermission() device");
            return;
        }

        // Normal, happy path:
        if (!granted || device == null) {
            Log.w(TAG, "USB permission denied or device null");
            return;
        }

        if (mClient == null) {
            Log.w(TAG, "mClient is null in handleUsbPermissionResult");
            return;
        }

        if (!deviceMatches(device)) {
            Log.w(TAG, "Permission granted for non-target device, ignoring");
            return;
        }

        try {
            Log.d(TAG, "Calling mClient.requestPermission(device) after grant");
            mClient.requestPermission(device);
        } catch (Throwable e) {
            Log.e(TAG, "mClient.requestPermission failed", e);
        }
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

            // Remember this device as our target
            targetVendorId = target.getVendorId();
            targetProductId = target.getProductId();

            initUsbPermissionIntent();
            manager.requestPermission(target, usbPermissionIntent);

            JSObject res = new JSObject();
            res.put("requested", true);
            res.put("deviceName", target.getDeviceName());
            res.put("vid", target.getVendorId());
            res.put("pid", target.getProductId());
            call.resolve(res);

        } catch (Exception e) {
            call.reject("requestUsbPermissionEarly failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void debugUsbState(PluginCall call) {
        UsbManager manager = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
        JSObject res = new JSObject();

        if (manager == null) {
            res.put("error", "UsbManager not available");
            call.resolve(res);
            return;
        }

        for (UsbDevice d : manager.getDeviceList().values()) {
            JSObject dev = new JSObject();
            dev.put("name", d.getDeviceName());
            dev.put("vid", d.getVendorId());
            dev.put("pid", d.getProductId());
            dev.put("hasPermission", manager.hasPermission(d));
            Log.d("UVC", "debugUsbState: " + dev.toString());
        }

        call.resolve(res);
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

    // ---------------- startPreview ----------------
    @PluginMethod
    public void startPreview(PluginCall call) {
        try {
            previewWidth = call.getInt("width", 640);
            previewHeight = call.getInt("height", 480);
            previewThrottleMs = call.getInt("throttleMs", 0);
            previewJpegQuality = call.getInt("jpegQuality", 70);

            stopPreviewInternal();

            currentRequest = new CameraRequest.Builder()
                    .setPreviewWidth(previewWidth)
                    .setPreviewHeight(previewHeight)
                    .setRenderMode(CameraRequest.RenderMode.NORMAL)
                    .setRawPreviewData(true)
                    .create();

            buildPreviewCallback();

            UsbManager manager =
                    (UsbManager) getContext().getSystemService(Context.USB_SERVICE);

            if (manager == null) {
                call.reject("UsbManager not available");
                return;
            }

            // 1️⃣ Pick the FIRST USB device (your requirement)
            UsbDevice firstDevice = null;
            for (UsbDevice d : manager.getDeviceList().values()) {
                firstDevice = d;
                Log.d(TAG, "Found USB device: " + d.getDeviceName()
                        + " VID=" + d.getVendorId()
                        + " PID=" + d.getProductId());
                break;
            }

            if (firstDevice == null) {
                Log.w(TAG, "No UVC detected → using INTERNAL camera fallback");

                currentSource = SourceMode.INTERNAL;

                internalCamera = new InternalCamera(getContext(), getActivity());
                internalCamera.start(previewWidth, previewHeight, (base64, w, h) -> {
                    JSObject payload = new JSObject();
                    payload.put("width", w);
                    payload.put("height", h);
                    payload.put("data", base64);
                    notifyListeners("frame", payload);
                });

                JSObject ok = new JSObject();
                ok.put("started", true);
                ok.put("fallback", "internal");
                call.resolve(ok);
                return;
            }

            // Remember this device as the target
            targetVendorId = firstDevice.getVendorId();
            targetProductId = firstDevice.getProductId();

            // 2️⃣ Create MultiCameraClient if needed
            if (mClient == null) {
                mClient = new MultiCameraClient(getContext(), new IDeviceConnectCallBack() {
                    @Override
                    public void onAttachDev(UsbDevice device) {
                        Log.d(TAG, "USB attached: " + device.getDeviceName());

                        UsbManager manager =
                                (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
                        if (manager == null) return;

                        // Only switch if we are currently using INTERNAL camera
                        if (currentSource != SourceMode.INTERNAL) return;

                        // Check if this is a video device
                        boolean isVideo = false;
                        for (int i = 0; i < device.getInterfaceCount(); i++) {
                            if (device.getInterface(i).getInterfaceClass()
                                    == UsbConstants.USB_CLASS_VIDEO) {
                                isVideo = true;
                                break;
                            }
                        }
                        if (!isVideo) return;

                        Log.w(TAG, "UVC attached while internal camera running → switching to UVC");

                        // Stop internal camera
                        if (internalCamera != null) {
                            internalCamera.stop();
                            internalCamera = null;
                        }

                        currentSource = SourceMode.UVC;

                        // Remember target device
                        targetVendorId = device.getVendorId();
                        targetProductId = device.getProductId();

                        // Request permission or open immediately
                        if (manager.hasPermission(device)) {
                            try {
                                mClient.requestPermission(device);
                            } catch (Throwable e) {
                                Log.e(TAG, "requestPermission failed on attach", e);
                            }
                        } else {
                            initUsbPermissionIntent();
                            manager.requestPermission(device, usbPermissionIntent);
                        }
                    }


                    @Override
                    public void onDetachDec(UsbDevice device) {
                        Log.d(TAG, "USB detached: " + device.getDeviceName());

                        if (deviceMatches(device)) {
                            Log.w(TAG, "Target UVC detached → switching to internal camera");

                            currentSource = SourceMode.INTERNAL;

                            if (mCamera != null) {
                                try { mCamera.closeCamera(); } catch (Throwable ignore) {}
                                mCamera = null;
                            }

                            internalCamera = new InternalCamera(getContext(), getActivity());
                            internalCamera.start(previewWidth, previewHeight, (base64, w, h) -> {
                                JSObject payload = new JSObject();
                                payload.put("width", w);
                                payload.put("height", h);
                                payload.put("data", base64);
                                notifyListeners("frame", payload);
                            });
                        }

                    }

                    @Override
                    public void onConnectDev(UsbDevice device, USBMonitor.UsbControlBlock ctrlBlock) {
                        Log.d(TAG, "USB connected: " + device.getDeviceName());
                        mainHandler.post(() -> openCameraForDevice(device, ctrlBlock));
                    }

                    @Override
                    public void onDisConnectDec(UsbDevice device, USBMonitor.UsbControlBlock ctrlBlock) {
                        Log.d(TAG, "USB disconnected: " + device.getDeviceName());
                        if (deviceMatches(device)) {
                            mainHandler.post(() -> {
                                if (mCamera != null) {
                                    try { mCamera.closeCamera(); } catch (Throwable ignore) {}
                                    mCamera = null;
                                }
                            });
                        }
                    }

                    @Override
                    public void onCancelDev(UsbDevice device) {
                        Log.d(TAG, "USB permission cancelled: " + device.getDeviceName());
                    }
                });
            }

            // 3️⃣ Start listening for attach/detach
            mClient.register();
            clientRegistered = true;

            boolean alreadyGranted = manager.hasPermission(firstDevice);
            Log.d(TAG, "startPreview: hasPermission=" + alreadyGranted
                    + " for " + firstDevice.getDeviceName());

            if (alreadyGranted) {
                // Skip system permission dialog & broken broadcast
                Log.d(TAG, "startPreview: permission already granted, calling mClient.requestPermission directly");
                try {
                    mClient.requestPermission(firstDevice);
                } catch (Throwable e) {
                    Log.e(TAG, "mClient.requestPermission (alreadyGranted path) failed", e);
                }
            } else {
                // Old path: request permission via PendingIntent + BroadcastReceiver
                initUsbPermissionIntent();
                Log.d(TAG, "Requesting USB permission for: " + firstDevice.getDeviceName());
                manager.requestPermission(firstDevice, usbPermissionIntent);
            }

            JSObject ok = new JSObject();
            ok.put("started", true);
            ok.put("deviceName", firstDevice.getDeviceName());
            ok.put("vid", firstDevice.getVendorId());
            ok.put("pid", firstDevice.getProductId());
            call.resolve(ok);

        } catch (Exception e) {
            Log.e(TAG, "startPreview failed", e);
            call.reject("startPreview failed: " + e.getMessage());
        }
    }

    // ---------------- preview callback (BASE64 ONLY) ----------------
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
        if (internalCamera != null) {
            internalCamera.stop();
            internalCamera = null;
        }

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

    // ---------------- captureSnapshot ----------------
    @PluginMethod
    public void captureSnapshot(final PluginCall call) {
        try {
            final String mode = call.getString("mode") == null ? "file" : call.getString("mode");
            Integer q = call.getInt("jpegQuality");
            final int jpegQuality = (q == null) ? 70 : q;
            Integer t = call.getInt("timeoutMs");
            final int timeoutMs = (t == null) ? 3000 : t;

            // -------------------------------------------------------
// INTERNAL CAMERA CAPTURE
// -------------------------------------------------------
            if (currentSource == SourceMode.INTERNAL) {
                if (internalCamera == null) {
                    call.reject("Internal camera not running");
                    return;
                }

                internalCamera.takeOneShot((base64, w, h) -> {
                    try {
                        if ("file".equalsIgnoreCase(mode)) {
                            byte[] jpegBytes = Base64.decode(base64, Base64.DEFAULT);
//                            jpegBytes = mirrorJpeg(jpegBytes);


                            File outDir = new File(getContext().getCacheDir(), "internal_snapshots");
                            if (!outDir.exists()) outDir.mkdirs();

                            File out = new File(
                                    outDir,
                                    "internal_snapshot_" + System.currentTimeMillis() + ".jpg"
                            );

                            try (FileOutputStream fos = new FileOutputStream(out)) {
                                fos.write(jpegBytes);
                            }

                            JSObject res = new JSObject();
                            res.put("width", w);
                            res.put("height", h);
                            res.put("file", "file://" + out.getAbsolutePath());
                            mainHandler.post(() -> call.resolve(res));
                        } else {
                            JSObject res = new JSObject();
                            res.put("width", w);
                            res.put("height", h);
                            res.put("data", base64);
                            mainHandler.post(() -> call.resolve(res));
                        }
                    } catch (Throwable e) {
                        mainHandler.post(() ->
                                call.reject("Internal capture failed: " + e.getMessage()));
                    }
                });

                return; // do NOT fall through to DSLR logic
            }


            // -------------------------------------------------------
            // DSLR/UVC CAPTURE (YOUR ORIGINAL CODE — UNTOUCHED)
            // -------------------------------------------------------

            final AtomicBoolean finished = new AtomicBoolean(false);

            final IPreviewDataCallBack oneShot = new IPreviewDataCallBack() {
                @Override
                public void onPreviewData(final byte[] data, final int width, final int height, DataFormat format) {
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
                                    jpegBytes = scaleJpeg(jpegBytes, 0.85f);
//                                    jpegBytes = mirrorJpeg(jpegBytes);
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
                        if (finished.compareAndSet(false, true))
                            call.reject("captureSnapshot failed: " + ex.getMessage());
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


    private byte[] scaleJpeg(byte[] jpegData, float scale) {
        Bitmap src = BitmapFactory.decodeByteArray(jpegData, 0, jpegData.length);
        int newW = (int)(src.getWidth() * scale);
        int newH = src.getHeight();

        Bitmap scaled = Bitmap.createScaledBitmap(src, newW, newH, true);

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        scaled.compress(Bitmap.CompressFormat.JPEG, 80, baos);

        return baos.toByteArray();
    }

    private byte[] mirrorJpeg(byte[] jpegBytes) {
        Bitmap src = BitmapFactory.decodeByteArray(jpegBytes, 0, jpegBytes.length);
        if (src == null) return jpegBytes;

        Matrix m = new Matrix();
        m.preScale(-1f, 1f); // horizontal mirror

        Bitmap mirrored = Bitmap.createBitmap(
                src, 0, 0, src.getWidth(), src.getHeight(), m, true
        );

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        mirrored.compress(Bitmap.CompressFormat.JPEG, 90, baos);

        src.recycle();
        mirrored.recycle();

        return baos.toByteArray();
    }


    // ---------------- capturePhoto ----------------
    @PluginMethod
    public void capturePhoto(final PluginCall call) {
        try {
//            if (mCamera == null || !mCamera.isCameraOpened()) {
//                call.reject("Camera not opened");
//                return;
//            }

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
