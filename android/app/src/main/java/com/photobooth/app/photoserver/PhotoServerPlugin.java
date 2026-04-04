package com.photobooth.app.photoserver;

import android.content.Context;
import android.net.wifi.WifiManager;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.Collections;
import java.util.UUID;

/**
 * Capacitor plugin that manages an embedded HTTP server for photo downloads.
 *
 * Methods:
 *  - startServer()       → starts NanoHTTPD on the specified port
 *  - stopServer()        → stops the server
 *  - savePhoto({ base64 }) → saves image, returns { downloadUrl, filename }
 *  - getServerInfo()     → returns { running, ip, port, url }
 */
@CapacitorPlugin(name = "PhotoServer")
public class PhotoServerPlugin extends Plugin {

    private static final String TAG = "PhotoServerPlugin";
    private static final int DEFAULT_PORT = 8080;

    private PhotoServer server;
    private File photosDir;
    private int port = DEFAULT_PORT;

    @Override
    public void load() {
        photosDir = new File(getContext().getFilesDir(), "shared_photos");
        if (!photosDir.exists()) {
            photosDir.mkdirs();
        }
    }

    @PluginMethod
    public void startServer(PluginCall call) {
        port = call.getInt("port", DEFAULT_PORT);

        if (server != null && server.isAlive()) {
            JSObject ret = new JSObject();
            ret.put("started", true);
            ret.put("message", "Server already running");
            ret.put("url", buildBaseUrl());
            call.resolve(ret);
            return;
        }

        try {
            server = new PhotoServer(port, photosDir);
            String baseUrl = buildBaseUrl();
            server.setBaseUrl(baseUrl);
            server.start();

            Log.i(TAG, "Photo server started at " + baseUrl);

            JSObject ret = new JSObject();
            ret.put("started", true);
            ret.put("url", baseUrl);
            ret.put("ip", getDeviceIp());
            ret.put("port", port);
            call.resolve(ret);
        } catch (IOException e) {
            Log.e(TAG, "Failed to start server", e);
            call.reject("Failed to start photo server: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopServer(PluginCall call) {
        if (server != null && server.isAlive()) {
            server.stop();
            Log.i(TAG, "Photo server stopped");
        }
        JSObject ret = new JSObject();
        ret.put("stopped", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void savePhoto(PluginCall call) {
        String base64 = call.getString("base64");
        if (base64 == null || base64.isEmpty()) {
            call.reject("Missing 'base64' parameter");
            return;
        }

        try {
            // Strip data URI prefix if present
            String cleanBase64 = base64;
            if (cleanBase64.contains(",")) {
                cleanBase64 = cleanBase64.substring(cleanBase64.indexOf(",") + 1);
            }

            byte[] bytes = Base64.decode(cleanBase64, Base64.DEFAULT);
            String filename = UUID.randomUUID().toString() + ".jpg";
            File file = new File(photosDir, filename);

            FileOutputStream fos = new FileOutputStream(file);
            fos.write(bytes);
            fos.flush();
            fos.close();

            String downloadUrl = buildBaseUrl() + "/download/" + filename;

            Log.i(TAG, "Saved photo: " + filename + " (" + (bytes.length / 1024) + " KB)");

            JSObject ret = new JSObject();
            ret.put("downloadUrl", downloadUrl);
            ret.put("filename", filename);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to save photo", e);
            call.reject("Failed to save photo: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getServerInfo(PluginCall call) {
        boolean running = server != null && server.isAlive();
        JSObject ret = new JSObject();
        ret.put("running", running);
        ret.put("ip", getDeviceIp());
        ret.put("port", port);
        ret.put("url", running ? buildBaseUrl() : null);
        call.resolve(ret);
    }

    private String buildBaseUrl() {
        return "http://" + getDeviceIp() + ":" + port;
    }

    /**
     * Gets the device's local IP address (non-loopback IPv4).
     * Works for both Wi-Fi and hotspot/tethering.
     */
    private String getDeviceIp() {
        try {
            for (NetworkInterface intf : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                // Skip loopback and down interfaces
                if (intf.isLoopback() || !intf.isUp()) continue;

                for (InetAddress addr : Collections.list(intf.getInetAddresses())) {
                    if (addr instanceof Inet4Address && !addr.isLoopbackAddress()) {
                        return addr.getHostAddress();
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error getting device IP", e);
        }

        // Fallback: try WifiManager
        try {
            WifiManager wm = (WifiManager) getContext().getApplicationContext()
                    .getSystemService(Context.WIFI_SERVICE);
            int ip = wm.getConnectionInfo().getIpAddress();
            if (ip != 0) {
                return String.format("%d.%d.%d.%d",
                        (ip & 0xff), (ip >> 8 & 0xff),
                        (ip >> 16 & 0xff), (ip >> 24 & 0xff));
            }
        } catch (Exception e) {
            Log.e(TAG, "WifiManager fallback failed", e);
        }

        return "127.0.0.1";
    }
}
