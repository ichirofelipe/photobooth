package com.photobooth.app.uvc;

import android.annotation.SuppressLint;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.ImageFormat;
import android.graphics.Rect;
import android.graphics.YuvImage;
import android.util.Base64;
import android.util.Log;

import androidx.camera.core.CameraSelector;
import androidx.camera.core.ImageAnalysis;
import androidx.camera.core.ImageProxy;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.core.content.ContextCompat;
import androidx.lifecycle.LifecycleOwner;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class InternalCamera {

    public interface Callback {
        void onFrame(String base64, int w, int h);
    }

    private static final String TAG = "InternalCam";

    private Callback oneShotCallback = null;

    public void takeOneShot(Callback cb) {
        this.oneShotCallback = cb;
    }

    private final Context ctx;
    private final LifecycleOwner owner;
    private final ExecutorService exec = Executors.newSingleThreadExecutor();
    private Callback callback;

    public InternalCamera(Context ctx, LifecycleOwner owner) {
        this.ctx = ctx;
        this.owner = owner;
    }

    @SuppressLint("UnsafeOptInUsageError")
    public void start(int width, int height, Callback cb) {
        this.callback = cb;

        ProcessCameraProvider.getInstance(ctx).addListener(() -> {
            try {
                ProcessCameraProvider provider = ProcessCameraProvider.getInstance(ctx).get();

                ImageAnalysis analysis = new ImageAnalysis.Builder()
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                        .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
                        .build();

                analysis.setAnalyzer(exec, image -> {
                    try {
                        int w = image.getWidth();
                        int h = image.getHeight();

                        ByteBuffer buffer = image.getPlanes()[0].getBuffer();
                        byte[] rgba = new byte[buffer.remaining()];
                        buffer.get(rgba);

                        Bitmap bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
                        bitmap.copyPixelsFromBuffer(ByteBuffer.wrap(rgba));

                        ByteArrayOutputStream baos = new ByteArrayOutputStream();
                        bitmap.compress(Bitmap.CompressFormat.JPEG, 70, baos);

                        String base64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);

                        if (callback != null) callback.onFrame(base64, w, h);

                        if (oneShotCallback != null) {
                            Callback tmp = oneShotCallback;
                            oneShotCallback = null;
                            tmp.onFrame(base64, w, h);
                        }

                        baos.close();
                    } catch (Exception e) {
                        Log.e(TAG, "Internal camera encode error", e);
                    }
                    image.close();
                });


                CameraSelector selector = CameraSelector.DEFAULT_FRONT_CAMERA;

                provider.unbindAll();
                provider.bindToLifecycle(owner, selector, analysis);

            } catch (Exception e) {
                Log.e(TAG, "CameraX start failed", e);
            }
        }, ContextCompat.getMainExecutor(ctx));
    }

    public void stop() {
        try { exec.shutdownNow(); } catch (Exception ignore) {}
    }

    private static byte[] YUV_420_888toNV21(ImageProxy image) {
        int width = image.getWidth();
        int height = image.getHeight();

        ImageProxy.PlaneProxy yPlane = image.getPlanes()[0];
        ImageProxy.PlaneProxy uPlane = image.getPlanes()[1];
        ImageProxy.PlaneProxy vPlane = image.getPlanes()[2];

        ByteArrayOutputStream out = new ByteArrayOutputStream();

        // ---- Y plane ----
        ByteBuffer yBuffer = yPlane.getBuffer();
        int yRowStride = yPlane.getRowStride();
        byte[] yBytes = new byte[yRowStride];

        for (int row = 0; row < height; row++) {
            yBuffer.position(row * yRowStride);
            yBuffer.get(yBytes, 0, width);
            out.write(yBytes, 0, width);
        }

        // ---- UV planes (interleaved as NV21: VU) ----
        ByteBuffer uBuffer = uPlane.getBuffer();
        ByteBuffer vBuffer = vPlane.getBuffer();

        int uvRowStride = uPlane.getRowStride();
        int uvPixelStride = uPlane.getPixelStride();

        byte[] uvRow = new byte[uvRowStride];

        for (int row = 0; row < height / 2; row++) {
            int uvRowStart = row * uvRowStride;

            uBuffer.position(uvRowStart);
            vBuffer.position(uvRowStart);

            for (int col = 0; col < width / 2; col++) {
                int uvIndex = col * uvPixelStride;

                byte v = vBuffer.get(uvIndex);
                byte u = uBuffer.get(uvIndex);

                out.write(v);
                out.write(u);
            }
        }

        return out.toByteArray();
    }

}
