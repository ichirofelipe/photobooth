package com.photobooth.app.uvc;

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
import android.content.Context;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;
import com.jiangdg.ausbc.MultiCameraClient;
import com.jiangdg.ausbc.callback.IPreviewDataCallBack;
import com.jiangdg.ausbc.callback.IDeviceConnectCallBack;
import com.jiangdg.ausbc.camera.bean.CameraRequest;
import com.jiangdg.usb.USBMonitor;
import com.jiangdg.ausbc.camera.CameraUVC;
import com.jiangdg.ausbc.callback.ICameraStateCallBack;
import com.jiangdg.ausbc.callback.ICaptureCallBack;


import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.lang.reflect.Constructor;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Improved UvcCameraPlugin:
 * - background compression (single-thread) to avoid blocking the camera pipeline
 * - modes: "base64" (default) or "file" (recommended)
 * - throttle (ms) and jpegQuality configurable from JS
 *
 * JS usage examples (short):
 * await UvcCameraPlugin.startPreview({ mode: 'file', throttleMs: 100, jpegQuality: 70 });
 * const listener = await UvcCameraPlugin.addListener('frame', (payload) => {
 *   if (payload.file) {
 *     const url = Capacitor.convertFileSrc(payload.file); // use convertFileSrc on the JS side
 *     img.src = url;
 *   } else if (payload.data) {
 *     img.src = 'data:image/jpeg;base64,' + payload.data;
 *   }
 * });
 */
@CapacitorPlugin(name = "UvcCameraPlugin")
public class UvcCameraPlugin extends Plugin {
    private static final String TAG = "UVC";
    private static final String ACTION_USB_PERMISSION = "com.photobooth.app.USB_PERMISSION";

    // AUSBC client + current camera
    private MultiCameraClient mClient = null;
    private MultiCameraClient.ICamera mCamera = null;

    // executor for compression/writing
    private final ExecutorService compressExecutor = Executors.newSingleThreadExecutor();
    // guard to avoid multi concurrent compress jobs (simple drop-frame approach)
    private final AtomicBoolean compressRunning = new AtomicBoolean(false);

    // main thread handler for notifyListeners
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    // Default values
    private static final int DEFAULT_THROTTLE_MS = 100;
    private static final int DEFAULT_JPEG_QUALITY = 70;

    // broadcast receiver for permission (optional; useful if you want permission events)
    private final android.content.BroadcastReceiver usbReceiver = new android.content.BroadcastReceiver() {
        @Override
        public void onReceive(Context ctx, Intent intent) {
            if (intent == null) return;
            if (!ACTION_USB_PERMISSION.equals(intent.getAction())) return;
            UsbDevice device = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
            boolean granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);
            JSObject payload = new JSObject();
            payload.put("deviceName", device != null ? device.getDeviceName() : null);
            payload.put("granted", granted);
            notifyListeners("usbPermission", payload);
            Log.d(TAG, "USB permission " + (granted ? "granted" : "denied") + " for " + (device != null ? device.getDeviceName() : "null"));
        }
    };

    @Override
    protected void handleOnStart() {
        super.handleOnStart();
        try { ContextCompat.registerReceiver(
    getContext(),
    usbReceiver,
    new IntentFilter(ACTION_USB_PERMISSION),
    ContextCompat.RECEIVER_NOT_EXPORTED
); } catch (Exception ignore) {}
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        stopPreviewInternal();
        try { getContext().unregisterReceiver(usbReceiver); } catch (Exception ignored) {}
        try { compressExecutor.shutdownNow(); } catch (Exception ignored) {}
    }

    @PluginMethod
    public void listUvcDevices(PluginCall call) {
        try {
            UsbManager usbManager = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
            List<java.util.Map<String,Object>> devices = new ArrayList<>();
            for (UsbDevice d : usbManager.getDeviceList().values()) {
                boolean isVideo = false;
                for (int i = 0; i < d.getInterfaceCount(); i++) {
                    if (d.getInterface(i).getInterfaceClass() == UsbConstants.USB_CLASS_VIDEO) {
                        isVideo = true; break;
                    }
                }
                if (!isVideo) continue;
                java.util.Map<String,Object> m = new java.util.HashMap<>();
                m.put("name", d.getDeviceName());
                m.put("vendorId", d.getVendorId());
                m.put("productId", d.getProductId());
                devices.add(m);
            }
            JSObject res = new JSObject();
            res.put("devices", devices);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("listUvcDevices failed: " + e.getMessage());
        }
    }

    /**
     * startPreview options (all optional)
     * - mode: "base64" | "file"  (default "base64")
     * - throttleMs: integer (ms) default 100 (0 = no throttle)
     * - jpegQuality: integer 1..100 (default 70)
     */
    @PluginMethod
    public void startPreview(PluginCall call) {
        try {
            final String mode = call.getString("mode") == null ? "base64" : call.getString("mode");
            Integer thr = call.getInt("throttleMs");
            final int throttleMs = thr == null ? DEFAULT_THROTTLE_MS : thr;
            Integer q = call.getInt("jpegQuality");
            final int jpegQuality = (q == null) ? DEFAULT_JPEG_QUALITY : q;

            // CameraRequest – request raw NV21 preview frames
            final CameraRequest request = new CameraRequest.Builder()
                    .setPreviewWidth(640)
                    .setPreviewHeight(480)
                    .setRenderMode(CameraRequest.RenderMode.NORMAL) // get raw frames
                    .setRawPreviewData(true)
                    .create();

            final long[] lastEmitTs = new long[] { 0L };

            final IPreviewDataCallBack previewCb = new IPreviewDataCallBack() {
                @Override
                public void onPreviewData(final byte[] data, final int width, final int height, IPreviewDataCallBack.DataFormat format) {
                    try {
                        if (data == null || width <= 0 || height <= 0) return;

                        // throttle
                        if (throttleMs > 0) {
                            long now = System.currentTimeMillis();
                            if (now - lastEmitTs[0] < throttleMs) return;
                            lastEmitTs[0] = now;
                        }

                        // If a compression job already running, drop this frame (keeps CPU stable)
                        if (!compressRunning.compareAndSet(false, true)) {
                            return;
                        }

                        // Submit job to compress/write (do NOT block camera thread)
                        compressExecutor.submit(() -> {
                            try {
                                // If data looks like JPEG (MJPEG), avoid recompression
                                boolean looksJpeg = data.length > 2 && (data[0] & 0xFF) == 0xFF && (data[1] & 0xFF) == 0xD8;

                                final JSObject payload = new JSObject();
                                payload.put("width", width);
                                payload.put("height", height);

                                if ("file".equalsIgnoreCase(mode)) {
                                    // Write JPEG bytes to cache and send file:// path
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
                                    // write to cache (overwrite same file to avoid buildup)
                                    File file = new File(getContext().getCacheDir(), "uvc_last_frame.jpg");
                                    try (FileOutputStream fos = new FileOutputStream(file, false)) {
                                        fos.write(jpegBytes);
                                        fos.flush();
                                    } catch (Exception e) {
                                        Log.e(TAG, "write frame file failed", e);
                                    }
                                    String fileUri = "file://" + (new File(getContext().getCacheDir(), "uvc_last_frame.jpg")).getAbsolutePath();
                                    payload.put("file", fileUri);
                                } else {
                                    // base64 mode (default)
                                    String base64;
                                    if (looksJpeg) {
                                        base64 = Base64.encodeToString(data, Base64.NO_WRAP);
                                    } else {
                                        YuvImage yuv = new YuvImage(data, ImageFormat.NV21, width, height, null);
                                        ByteArrayOutputStream baos = new ByteArrayOutputStream();
                                        yuv.compressToJpeg(new Rect(0, 0, width, height), jpegQuality, baos);
                                        base64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);
                                        try { baos.close(); } catch (Exception ignore) {}
                                    }
                                    payload.put("data", base64);
                                }

                                // dispatch to JS on main thread
                                mainHandler.post(() -> notifyListeners("frame", payload));
                            } catch (Throwable ex) {
                                Log.e(TAG, "compress job failed", ex);
                            } finally {
                                compressRunning.set(false);
                            }
                        });

                    } catch (Throwable ex) {
                        Log.e(TAG, "previewCb error", ex);
                    }
                }
            };

            // create client and device connect callback (if not created)
            if (mClient == null) {
                mClient = new MultiCameraClient(getContext(), new IDeviceConnectCallBack() {
                    @Override public void onAttachDev(UsbDevice device) { Log.d(TAG, "USB attached: " + (device != null ? device.getDeviceName() : "null")); }
                    @Override public void onDetachDec(UsbDevice device) { Log.d(TAG, "USB detached: " + (device != null ? device.getDeviceName() : "null")); }

                    @Override
                    public void onConnectDev(final UsbDevice device, final USBMonitor.UsbControlBlock ctrlBlock) {
                        Log.d(TAG, "onConnectDev: " + (device != null ? device.getDeviceName() : "null"));
                        mainHandler.post(() -> {
                            try {
                                // close previous camera
                                if (mCamera != null) {
                                    try { mCamera.closeCamera(); } catch (Throwable ignored) {}
                                    mCamera = null;
                                }

                                // instantiate a CameraUVC (different lib versions have different ctors) via reflection
                                MultiCameraClient.ICamera cam = createCameraUvcInstance(device);
                                if (cam == null) {
                                    Log.e(TAG, "Cannot instantiate CameraUVC for device");
                                    return;
                                }
                                mCamera = cam;

                                // optional: camera state callback
                                try {
                                    mCamera.setCameraStateCallBack(new ICameraStateCallBack() {
                                        @Override
                                        public void onCameraState(MultiCameraClient.ICamera self, ICameraStateCallBack.State state, String msg) {
                                            Log.d(TAG, "Camera state: " + state + " msg=" + msg);
                                        }
                                    });
                                } catch (Throwable ignore) {}

                                // attach preview callback (raw frames), then give control block, open camera
                                mCamera.addPreviewDataCallBack(previewCb);
                                mCamera.setUsbControlBlock(ctrlBlock);
                                mCamera.openCamera(null, request);

                                Log.d(TAG, "Requested openCamera for: " + (device != null ? device.getDeviceName() : "null"));
                            } catch (Throwable e) {
                                Log.e(TAG, "open camera failed", e);
                            }
                        });
                    }

                    @Override public void onDisConnectDec(UsbDevice device, USBMonitor.UsbControlBlock ctrlBlock) {
                        Log.d(TAG, "onDisConnectDec: " + (device != null ? device.getDeviceName() : "null"));
                        mainHandler.post(() -> {
                            try {
                                if (mCamera != null && mCamera.getUsbDevice() != null &&
                                        mCamera.getUsbDevice().getDeviceId() == (device != null ? device.getDeviceId() : -1)) {
                                    try { mCamera.closeCamera(); } catch (Throwable ignored) {}
                                    mCamera = null;
                                }
                            } catch (Throwable ignored) {}
                        });
                    }

                    @Override public void onCancelDev(UsbDevice device) { Log.d(TAG, "onCancelDev: " + (device != null ? device.getDeviceName() : "null")); }
                });
            }

            // register monitor (triggers connect callback if device already present) and request permissions for known devices
            mClient.register();
            try {
                List<UsbDevice> deviceList = mClient.getDeviceList(null);
                if (deviceList != null) {
                    for (UsbDevice d : deviceList) {
                        Log.d(TAG, "Device: " + d.getDeviceName() + " hasPerm=" + mClient.hasPermission(d));
                        mClient.requestPermission(d);
                    }
                } else {
                    Log.d(TAG, "No devices found in monitor");
                }
            } catch (Throwable t) {
                Log.w(TAG, "requestPermission loop failed", t);
            }

            JSObject ok = new JSObject();
            ok.put("started", true);
            call.resolve(ok);

        } catch (Exception e) {
            Log.e(TAG, "startPreview error", e);
            call.reject("startPreview failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopPreview(PluginCall call) {
        try {
            stopPreviewInternal();
            JSObject r = new JSObject();
            r.put("stopped", true);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("stopPreview failed: " + e.getMessage());
        }
    }

    private void stopPreviewInternal() {
        try {
            if (mCamera != null) {
                try { mCamera.closeCamera(); } catch (Throwable ignored) {}
                mCamera = null;
            }
            if (mClient != null) {
                try { mClient.unRegister(); } catch (Throwable ignored) {}
                try { mClient.destroy(); } catch (Throwable ignored) {}
                mClient = null;
            }
        } catch (Throwable t) {
            Log.w(TAG, "stopPreviewInternal: " + t.getMessage());
        }
    }

    // Helper: try to instantiate CameraUVC with multiple constructor signatures
    private MultiCameraClient.ICamera createCameraUvcInstance(UsbDevice device) {
        try {
            // common ctor: CameraUVC(Context, UsbDevice)
            try {
                Constructor<CameraUVC> c = CameraUVC.class.getConstructor(Context.class, UsbDevice.class);
                CameraUVC camera = c.newInstance(getContext(), device);
                return camera;
            } catch (NoSuchMethodException ignore) {}

            // CameraUVC(Context)
            try {
                Constructor<CameraUVC> c2 = CameraUVC.class.getConstructor(Context.class);
                CameraUVC camera = c2.newInstance(getContext());
                return camera;
            } catch (NoSuchMethodException ignore) {}

            // last resort: any ctor starting with Context, try to fill in reasonable defaults
            for (Constructor<?> cons : CameraUVC.class.getConstructors()) {
                Class<?>[] params = cons.getParameterTypes();
                if (params.length >= 1 && params[0] == Context.class) {
                    Object[] args = new Object[params.length];
                    args[0] = getContext();
                    for (int i = 1; i < params.length; i++) {
                        if (params[i] == UsbDevice.class) args[i] = device;
                        else args[i] = getDefaultForType(params[i]);
                    }
                    return (MultiCameraClient.ICamera) cons.newInstance(args);
                }
            }
        } catch (Throwable t) {
            Log.e(TAG, "createCameraUvcInstance failed", t);
        }
        return null;
    }

    private Object getDefaultForType(Class<?> cls) {
        if (!cls.isPrimitive()) return null;
        if (cls == boolean.class) return false;
        if (cls == byte.class) return (byte) 0;
        if (cls == short.class) return (short) 0;
        if (cls == int.class) return 0;
        if (cls == long.class) return 0L;
        if (cls == float.class) return 0f;
        if (cls == double.class) return 0d;
        if (cls == char.class) return '\0';
        return null;
    }

    // ------------------------------------------------------------------
// captureSnapshot: one-shot capture of next preview frame
// options: mode: "file"|"base64" (default "file"), jpegQuality [1..100], timeoutMs
// ------------------------------------------------------------------
    @PluginMethod
    public void captureSnapshot(final PluginCall call) {
        try {
            if (mCamera == null || !mCamera.isCameraOpened()) {
                call.reject("Camera not opened");
                return;
            }

            final String mode = call.getString("mode") == null ? "file" : call.getString("mode");
            Integer q = call.getInt("jpegQuality"); final int jpegQuality = (q == null) ? 70 : q;
            Integer t = call.getInt("timeoutMs"); final int timeoutMs = (t == null) ? 3000 : t;

            final AtomicBoolean finished = new AtomicBoolean(false);

            final IPreviewDataCallBack oneShot = new IPreviewDataCallBack() {
                @Override
                public void onPreviewData(final byte[] data, final int width, final int height, IPreviewDataCallBack.DataFormat format) {
                    try {
                        if (finished.getAndSet(true)) return;

                        // remove this callback immediately
                        try { mCamera.removePreviewDataCallBack(this); } catch (Throwable ignored) {}

                        // run compression/writing on background executor (reuse same compressExecutor)
                        compressExecutor.submit(() -> {
                            try {
                                boolean looksJpeg = data != null && data.length > 2 && (data[0] & 0xFF) == 0xFF && (data[1] & 0xFF) == 0xD8;
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
                                if (finished.compareAndSet(true, true)) {
                                    mainHandler.post(() -> call.reject("captureSnapshot failed: " + ex.getMessage()));
                                }
                            }
                        });

                    } catch (Throwable ex) {
                        if (finished.compareAndSet(false, true)) call.reject("captureSnapshot failed: " + ex.getMessage());
                    }
                }
            };

            // register the one-shot preview callback
            mCamera.addPreviewDataCallBack(oneShot);

            // timeout guard
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

    // ------------------------------------------------------------------
// capturePhoto: use the camera's captureImage if available (full-resolution path)
// This calls mCamera.captureImage(ICaptureCallBack, outPath) and resolves when complete.
// ------------------------------------------------------------------
    @PluginMethod
    public void capturePhoto(final PluginCall call) {
        try {
            if (mCamera == null || !mCamera.isCameraOpened()) {
                call.reject("Camera not opened");
                return;
            }

            // Determine a safe default outPath (we'll still attempt captureImage first)
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

            // Try to use the library's captureImage first (preferred: may be higher-res / camera-native)
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
                        // If library refused because of storage permission, fallback to snapshot-based capture
                        if (!finished.compareAndSet(false, true)) return;
                        String errLower = (error == null) ? "" : error.toLowerCase();
                        if (errLower.contains("permission") || errLower.contains("storage")) {
                            Log.w(TAG, "captureImage failed due to storage permission; falling back to captureSnapshot()");
                            try {
                                // Call the preview-based one-shot capture which writes into app cache / files
                                // captureSnapshot will resolve/reject the same PluginCall
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
                // done — either onComplete or onError will resolve/reject the call (or fallback will)
            } catch (Throwable e) {
                // if captureImage throwed synchronously, fallback to snapshot-based capture
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
