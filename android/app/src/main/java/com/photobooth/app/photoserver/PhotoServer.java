package com.photobooth.app.photoserver;

import android.util.Log;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;

import fi.iki.elonen.NanoHTTPD;

/**
 * Lightweight HTTP server that serves saved photo files over the local network.
 * Users connected to the same Wi-Fi / hotspot can download photos by URL.
 *
 * Routes:
 *   GET /download/<filename>  → HTML landing page with auto-download + button
 *   GET /photos/<filename>    → raw image file (with Content-Disposition: attachment)
 *   GET /ping                 → health check
 */
public class PhotoServer extends NanoHTTPD {

    private static final String TAG = "PhotoServer";
    private final File photosDir;
    private String baseUrl = "";

    public PhotoServer(int port, File photosDir) {
        super(port);
        this.photosDir = photosDir;

        if (!photosDir.exists()) {
            photosDir.mkdirs();
        }
    }

    public void setBaseUrl(String url) {
        this.baseUrl = url;
    }

    @Override
    public Response serve(IHTTPSession session) {
        String uri = session.getUri();
        Log.d(TAG, "Request: " + session.getMethod() + " " + uri);

        // CORS preflight
        if (Method.OPTIONS.equals(session.getMethod())) {
            Response res = newFixedLengthResponse(Response.Status.OK, MIME_PLAINTEXT, "");
            addCorsHeaders(res);
            return res;
        }

        // Download landing page: /download/<filename>
        if (uri.startsWith("/download/")) {
            String filename = uri.substring("/download/".length());
            if (!isValidFilename(filename)) {
                return newFixedLengthResponse(Response.Status.FORBIDDEN, MIME_PLAINTEXT, "Forbidden");
            }

            File file = new File(photosDir, filename);
            if (!file.exists() || !file.isFile()) {
                return newFixedLengthResponse(Response.Status.NOT_FOUND, "text/html",
                        buildErrorPage("Photo not found", "This photo may have expired or been removed."));
            }

            String photoUrl = baseUrl + "/photos/" + filename;
            String html = buildDownloadPage(photoUrl, filename);
            Response res = newFixedLengthResponse(Response.Status.OK, "text/html", html);
            addCorsHeaders(res);
            return res;
        }

        // Raw image file: /photos/<filename>
        if (uri.startsWith("/photos/")) {
            String filename = uri.substring("/photos/".length());
            if (!isValidFilename(filename)) {
                return newFixedLengthResponse(Response.Status.FORBIDDEN, MIME_PLAINTEXT, "Forbidden");
            }

            File file = new File(photosDir, filename);
            if (!file.exists() || !file.isFile()) {
                return newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "Not found");
            }

            try {
                FileInputStream fis = new FileInputStream(file);
                String mimeType = getMimeType(filename);
                Response res = newFixedLengthResponse(Response.Status.OK, mimeType, fis, file.length());
                res.addHeader("Content-Disposition", "attachment; filename=\"" + filename + "\"");
                addCorsHeaders(res);
                return res;
            } catch (IOException e) {
                Log.e(TAG, "Error serving file: " + filename, e);
                return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, MIME_PLAINTEXT, "Server error");
            }
        }

        // Health check
        if ("/ping".equals(uri)) {
            Response res = newFixedLengthResponse(Response.Status.OK, "application/json", "{\"status\":\"ok\"}");
            addCorsHeaders(res);
            return res;
        }

        return newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "Not found");
    }

    private boolean isValidFilename(String filename) {
        return filename != null
                && !filename.contains("..")
                && !filename.contains("/")
                && !filename.contains("\\");
    }

    /**
     * Builds an HTML download page with:
     * - Auto-download attempt on page load
     * - Photo preview
     * - Prominent "Download Photo" button as fallback
     */
    private String buildDownloadPage(String photoUrl, String filename) {
        return "<!DOCTYPE html>"
            + "<html lang=\"en\"><head>"
            + "<meta charset=\"UTF-8\">"
            + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0,user-scalable=no\">"
            + "<title>Download Your Photo</title>"
            + "<style>"
            + "*{margin:0;padding:0;box-sizing:border-box}"
            + "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"
            + "background:#fcf2e4;min-height:100vh;display:flex;flex-direction:column;"
            + "align-items:center;justify-content:center;padding:24px;color:#1a1a1a}"
            + ".card{background:#fff;border-radius:16px;padding:24px;text-align:center;"
            + "box-shadow:0 4px 24px rgba(0,0,0,.12);max-width:380px;width:100%}"
            + ".icon{font-size:48px;margin-bottom:8px}"
            + "h1{font-size:22px;font-weight:700;margin-bottom:4px}"
            + ".subtitle{color:#999;font-size:14px;margin-bottom:16px}"
            + ".preview{width:100%;max-height:260px;object-fit:contain;border-radius:8px;"
            + "border:2px solid #fcf2e4;margin-bottom:16px}"
            + ".btn{display:inline-block;background:#fe6d6d;color:#fff;font-size:18px;"
            + "font-weight:600;padding:14px 32px;border-radius:32px;text-decoration:none;"
            + "border:none;cursor:pointer;width:100%;transition:background .2s}"
            + ".btn:active{background:#e55a5a}"
            + ".hint{color:#999;font-size:12px;margin-top:12px}"
            + "</style></head><body>"
            + "<div class=\"card\">"
            + "<div class=\"icon\">&#128247;</div>"
            + "<h1>Your Photo is Ready!</h1>"
            + "<p class=\"subtitle\">Tap the button below to save it</p>"
            + "<img class=\"preview\" src=\"" + photoUrl + "\" alt=\"Your photo\"/>"
            + "<a class=\"btn\" href=\"" + photoUrl + "\" download=\"photobooth-photo.jpg\">"
            + "&#11015; Download Photo</a>"
            + "<p class=\"hint\">If download doesn't start, long-press the image above to save</p>"
            + "</div>"
            + "<script>"
            + "window.addEventListener('load',function(){"
            + "var a=document.createElement('a');"
            + "a.href='" + photoUrl + "';"
            + "a.download='photobooth-photo.jpg';"
            + "document.body.appendChild(a);"
            + "a.click();"
            + "document.body.removeChild(a);"
            + "});"
            + "</script>"
            + "</body></html>";
    }

    private String buildErrorPage(String title, String message) {
        return "<!DOCTYPE html><html><head>"
            + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\">"
            + "<style>body{font-family:sans-serif;display:flex;align-items:center;"
            + "justify-content:center;min-height:100vh;background:#fcf2e4;color:#1a1a1a;"
            + "text-align:center}h1{font-size:22px}p{color:#999;margin-top:8px}</style>"
            + "</head><body><div><h1>" + title + "</h1><p>" + message + "</p></div>"
            + "</body></html>";
    }

    private void addCorsHeaders(Response res) {
        res.addHeader("Access-Control-Allow-Origin", "*");
        res.addHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
        res.addHeader("Access-Control-Allow-Headers", "Content-Type");
    }

    private String getMimeType(String filename) {
        if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) return "image/jpeg";
        if (filename.endsWith(".png")) return "image/png";
        if (filename.endsWith(".webp")) return "image/webp";
        return "application/octet-stream";
    }
}
