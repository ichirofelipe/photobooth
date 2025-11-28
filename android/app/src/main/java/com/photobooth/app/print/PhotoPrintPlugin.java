package com.photobooth.app.print;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Rect;
import android.graphics.RectF;
import android.os.ParcelFileDescriptor;
import android.print.PrintManager;
import android.print.PrintAttributes;
import android.print.pdf.PrintedPdfDocument;
import android.print.PageRange;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;

import android.util.Base64;
import java.io.File;
import java.io.FileOutputStream;

@CapacitorPlugin(name = "PhotoPrint")
public class PhotoPrintPlugin extends Plugin {

    @PluginMethod
    public void print(PluginCall call) {
        String base64 = call.getString("base64");

        if (base64 == null) {
            call.reject("missing base64");
            return;
        }

        try {
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);

            PrintManager pm = (PrintManager) getContext().getSystemService(Context.PRINT_SERVICE);

            pm.print(
                    "Photobooth_Print",
                    new PhotoPrintAdapter(getContext(), bitmap),
                    createAttributes()
            );

            call.resolve();
        } catch (Exception e) {
            call.reject("Failed: " + e.getMessage());
        }
    }

    private PrintAttributes createAttributes() {
        return new PrintAttributes.Builder()
                .setMediaSize(new PrintAttributes.MediaSize("4x6", "android", 4000, 6000)) // Portrait 4x6
                .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
                .setResolution(new PrintAttributes.Resolution("300dpi", "300dpi", 300, 300))
                .build();
    }

    private static class PhotoPrintAdapter extends PrintDocumentAdapter {
        private final Context context;
        private final Bitmap bitmap;
        private PrintAttributes attributes;

        PhotoPrintAdapter(Context context, Bitmap bitmap) {
            this.context = context;
            this.bitmap = bitmap;
        }

        @Override
        public void onLayout(PrintAttributes oldAttributes, PrintAttributes newAttributes,
                             android.os.CancellationSignal cancellationSignal,
                             LayoutResultCallback callback, android.os.Bundle extras) {
            attributes = newAttributes;

            PrintDocumentInfo info = new PrintDocumentInfo
                    .Builder("photobooth_4x6.pdf")
                    .setContentType(PrintDocumentInfo.CONTENT_TYPE_PHOTO)
                    .setPageCount(1)
                    .build();

            callback.onLayoutFinished(info, true);
        }

        @Override
        public void onWrite(PageRange[] pages, ParcelFileDescriptor destination,
                            android.os.CancellationSignal cancellationSignal, WriteResultCallback callback) {

            PrintedPdfDocument pdf = new PrintedPdfDocument(context, attributes);

            try {
                PrintedPdfDocument.Page page = pdf.startPage(0);
                Canvas canvas = page.getCanvas();

                float shrink = 0.99f;     // shrink to compensate HP overspray
                float shiftX = -2f;        // move right by 3 pixels
                float shiftY = -4.75f;       // move up by 3 pixels
// --------------------------------------

// Printable content rect
                Rect content = page.getInfo().getContentRect();

// Aspect ratios
                float bitmapRatio = (float) bitmap.getWidth() / bitmap.getHeight();
                float pageRatio = (float) content.width() / content.height();

                float finalWidth, finalHeight;

// Fit-inside scaling to preserve aspect ratio
                if (bitmapRatio > pageRatio) {
                    finalWidth = content.width();
                    finalHeight = finalWidth / bitmapRatio;
                } else {
                    finalHeight = content.height();
                    finalWidth = finalHeight * bitmapRatio;
                }

// Apply shrink factor
                finalWidth *= shrink;
                finalHeight *= shrink;

// Center the image
                float left = content.left + (content.width() - finalWidth) / 2f;
                float top  = content.top  + (content.height() - finalHeight) / 2f;

// Apply pixel offsets
                left += shiftX;
                top  += shiftY;

// Destination rectangle
                RectF dst = new RectF(left, top, left + finalWidth, top + finalHeight);

// Draw it
                canvas.drawBitmap(bitmap, null, dst, null);


                pdf.finishPage(page);

                FileOutputStream out = new FileOutputStream(destination.getFileDescriptor());
                pdf.writeTo(out);
                out.close();

                callback.onWriteFinished(new PageRange[]{PageRange.ALL_PAGES});

            } catch (Exception e) {
                callback.onWriteFailed(e.getMessage());
            } finally {
                pdf.close();
            }
        }
    }
}
