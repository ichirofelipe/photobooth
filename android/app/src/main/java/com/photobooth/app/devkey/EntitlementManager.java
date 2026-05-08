package com.photobooth.app.devkey;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.util.UUID;

/**
 * Manages the per-device UUID and the cached entitlement lease records.
 *
 * The server signs canonical entitlement payloads with a private RSA key.
 * The app verifies them with the matching public key supplied by the JS layer.
 *
 * Canonical string format:
 *   "{deviceId}|{feature}|{licenseId}|{issuedAt}|{expiresAt}"
 * This must stay in sync with canonicalString() in activation-server.js.
 *
 * For backward compatibility, v1 entitlements without licenseId are still
 * accepted using the old canonical form until they naturally roll over.
 */
public class EntitlementManager {

    private static final String PREFS_NAME = "entitlements_v1";
    private static final String KEY_DEVICE_ID = "device_id";
    private static final String ENTITLEMENT_PREFIX = "ent_";
    private static final int CONNECT_TIMEOUT_MS = 5_000;
    private static final int READ_TIMEOUT_MS = 10_000;

    /**
     * Returns the persisted device UUID, creating and storing one on first call.
     * This remains stable until app data is cleared.
     */
    public static String getOrCreateDeviceId(Context context) {
        SharedPreferences prefs = prefs(context);
        String existing = prefs.getString(KEY_DEVICE_ID, null);
        if (existing != null) return existing;

        String id = UUID.randomUUID().toString();
        prefs.edit().putString(KEY_DEVICE_ID, id).apply();
        return id;
    }

    public static void saveEntitlement(Context context, JSONObject entitlement) {
        try {
            String feature = entitlement.getString("feature");
            prefs(context)
                    .edit()
                    .putString(ENTITLEMENT_PREFIX + feature, entitlement.toString())
                    .apply();
        } catch (JSONException e) {
            e.printStackTrace();
        }
    }

    public static void removeEntitlement(Context context, String feature) {
        prefs(context).edit().remove(ENTITLEMENT_PREFIX + feature).apply();
    }

    public static JSONObject getValidEntitlement(
            Context context,
            String feature,
            String publicKeyBase64
    ) {
        String raw = prefs(context).getString(ENTITLEMENT_PREFIX + feature, null);
        if (raw == null) return null;
        try {
            JSONObject obj = new JSONObject(raw);
            return verifyEntitlement(context, obj, publicKeyBase64) ? obj : null;
        } catch (JSONException e) {
            return null;
        }
    }

    /**
     * Verifies that an entitlement JSON object:
     *  1. Belongs to this device
     *  2. Has not expired
     *  3. Has a valid RSA signature from the activation server
     */
    public static boolean verifyEntitlement(
            Context context,
            JSONObject obj,
            String publicKeyBase64
    ) {
        try {
            if (publicKeyBase64 == null || publicKeyBase64.isEmpty()) return false;
            if (!getOrCreateDeviceId(context).equals(obj.getString("deviceId"))) return false;
            if (System.currentTimeMillis() > obj.getLong("expiresAt")) return false;

            String canonical = buildCanonicalString(obj);

            PublicKey publicKey = decodePublicKey(publicKeyBase64);
            Signature verifier = Signature.getInstance("SHA256withRSA");
            verifier.initVerify(publicKey);
            verifier.update(canonical.getBytes(StandardCharsets.UTF_8));

            byte[] signatureBytes = Base64.decode(obj.getString("sig"), Base64.DEFAULT);
            return verifier.verify(signatureBytes);
        } catch (Exception e) {
            return false;
        }
    }

    public static JSONObject httpPost(String urlStr, JSONObject body)
            throws IOException, JSONException {
        URL url = new URL(urlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        try {
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            conn.setDoOutput(true);
            conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
            conn.setReadTimeout(READ_TIMEOUT_MS);

            try (OutputStream os = conn.getOutputStream()) {
                os.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }

            int status = conn.getResponseCode();
            StringBuilder sb = new StringBuilder();
            try (BufferedReader br = new BufferedReader(new InputStreamReader(
                    status >= 400 ? conn.getErrorStream() : conn.getInputStream(),
                    StandardCharsets.UTF_8))) {
                String line;
                while ((line = br.readLine()) != null) sb.append(line);
            }

            String responseBody = sb.toString().trim();
            if (!responseBody.startsWith("{")) {
                throw new IOException(
                        "Activation server returned an unexpected response. Check that the app activation server URL points to the Render service root."
                );
            }

            JSONObject response = new JSONObject(responseBody);
            if (status >= 400) {
                throw new IOException("Server error " + status + ": "
                        + response.optString("error", "unknown"));
            }
            return response;
        } finally {
            conn.disconnect();
        }
    }

    private static PublicKey decodePublicKey(String publicKeyBase64) throws Exception {
        byte[] keyBytes = Base64.decode(publicKeyBase64, Base64.DEFAULT);
        X509EncodedKeySpec keySpec = new X509EncodedKeySpec(keyBytes);
        return KeyFactory.getInstance("RSA").generatePublic(keySpec);
    }

    private static String buildCanonicalString(JSONObject obj) throws JSONException {
        String deviceId = obj.getString("deviceId");
        String feature = obj.getString("feature");
        long issuedAt = obj.getLong("issuedAt");
        long expiresAt = obj.getLong("expiresAt");

        if (obj.has("licenseId") && !obj.isNull("licenseId")) {
            return deviceId + "|"
                    + feature + "|"
                    + obj.getString("licenseId") + "|"
                    + issuedAt + "|"
                    + expiresAt;
        }

        return deviceId + "|"
                + feature + "|"
                + issuedAt + "|"
                + expiresAt;
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }
}
