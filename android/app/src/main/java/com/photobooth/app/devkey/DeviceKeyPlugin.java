package com.photobooth.app.devkey;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.net.SocketTimeoutException;
import java.net.UnknownHostException;

@CapacitorPlugin(name = "DeviceKey")
public class DeviceKeyPlugin extends Plugin {

    private static final String[] ALL_FEATURES = {"base_app", "qr_download", "template_editor"};
    private static final String ACTIVATION_WAKE_MESSAGE =
            "The activation server may still be waking up. Please wait 30-60 seconds, then tap Activate again.";
    private static final String ACTIVATION_ADDRESS_MESSAGE =
            "The activation server address cannot be reached. Check your internet connection or contact support.";

    @PluginMethod()
    public void getDeviceId(PluginCall call) {
        String deviceId = EntitlementManager.getOrCreateDeviceId(getContext());
        JSObject ret = new JSObject();
        ret.put("deviceId", deviceId);
        call.resolve(ret);
    }

    @PluginMethod()
    public void getEntitlements(PluginCall call) {
        String publicKey = call.getString("publicKey");
        if (publicKey == null || publicKey.isEmpty()) {
            call.reject("Missing required parameter: publicKey.");
            return;
        }

        JSArray entitlements = new JSArray();
        for (String feature : ALL_FEATURES) {
            JSONObject ent = EntitlementManager.getValidEntitlement(getContext(), feature, publicKey);
            if (ent == null) {
                continue;
            }

            try {
                JSObject item = new JSObject();
                item.put("feature", ent.getString("feature"));
                item.put("deviceId", ent.getString("deviceId"));
                if (ent.has("licenseId")) {
                    item.put("licenseId", ent.optString("licenseId", null));
                }
                item.put("issuedAt", ent.getLong("issuedAt"));
                item.put("expiresAt", ent.getLong("expiresAt"));
                item.put("sig", ent.getString("sig"));
                entitlements.put(item);
            } catch (JSONException ignored) {
                // Skip malformed entries that already failed verification.
            }
        }

        JSObject ret = new JSObject();
        ret.put("entitlements", entitlements);
        call.resolve(ret);
    }

    @PluginMethod()
    public void activateLicense(PluginCall call) {
        String key = call.getString("key");
        String feature = call.getString("feature");
        String serverUrl = call.getString("serverUrl");
        String publicKey = call.getString("publicKey");

        if (key == null || feature == null || serverUrl == null || publicKey == null) {
            call.reject("Missing required parameters: key, feature, serverUrl, publicKey.");
            return;
        }

        String deviceId = EntitlementManager.getOrCreateDeviceId(getContext());

        try {
            JSONObject body = new JSONObject();
            body.put("key", key);
            body.put("deviceId", deviceId);
            body.put("feature", feature);

            JSONObject response = EntitlementManager.httpPost(serverUrl + "/activate", body);
            JSONArray entitlements = response.optJSONArray("entitlements");
            if (entitlements == null && response.has("entitlement")) {
                entitlements = new JSONArray();
                entitlements.put(response.getJSONObject("entitlement"));
            }

            JSArray activatedFeatures = new JSArray();
            if (entitlements != null) {
                for (int i = 0; i < entitlements.length(); i++) {
                    JSONObject entitlement = entitlements.getJSONObject(i);
                    if (!EntitlementManager.verifyEntitlement(getContext(), entitlement, publicKey)) {
                        call.reject("Server returned an invalid entitlement payload.");
                        return;
                    }

                    EntitlementManager.saveEntitlement(getContext(), entitlement);
                    activatedFeatures.put(entitlement.getString("feature"));
                }
            }

            JSObject result = new JSObject();
            result.put("transferred", response.optBoolean("transferred", false));
            result.put("activatedFeatures", activatedFeatures);
            call.resolve(result);
        } catch (Exception e) {
            call.reject(activationErrorMessage(e));
        }
    }

    @PluginMethod()
    public void syncEntitlements(PluginCall call) {
        String serverUrl = call.getString("serverUrl");
        String publicKey = call.getString("publicKey");
        JSArray entitlementItems = call.getArray("entitlements");

        if (serverUrl == null || publicKey == null || entitlementItems == null) {
            call.reject("Missing required parameters: serverUrl, publicKey, entitlements.");
            return;
        }

        String deviceId = EntitlementManager.getOrCreateDeviceId(getContext());

        try {
            JSONArray requestedEntitlements = new JSONArray();
            for (int i = 0; i < entitlementItems.length(); i++) {
                JSONObject item = entitlementItems.getJSONObject(i);
                JSONObject payload = new JSONObject();
                payload.put("feature", item.getString("feature"));
                if (item.has("licenseId") && !item.isNull("licenseId")) {
                    payload.put("licenseId", item.getString("licenseId"));
                }
                requestedEntitlements.put(payload);
            }

            JSONObject body = new JSONObject();
            body.put("deviceId", deviceId);
            body.put("entitlements", requestedEntitlements);

            JSONObject response = EntitlementManager.httpPost(serverUrl + "/sync", body);

            JSONArray entitlements = response.optJSONArray("entitlements");
            if (entitlements != null) {
                for (int i = 0; i < entitlements.length(); i++) {
                    JSONObject ent = entitlements.getJSONObject(i);
                    if (EntitlementManager.verifyEntitlement(getContext(), ent, publicKey)) {
                        EntitlementManager.saveEntitlement(getContext(), ent);
                    }
                }
            }

            JSArray revokedItems = new JSArray();
            JSONArray revoked = response.optJSONArray("revoked");
            if (revoked != null) {
                for (int i = 0; i < revoked.length(); i++) {
                    JSONObject item = revoked.getJSONObject(i);
                    String feature = item.getString("feature");
                    EntitlementManager.removeEntitlement(getContext(), feature);

                    JSObject revokedItem = new JSObject();
                    revokedItem.put("feature", feature);
                    revokedItem.put("reason", item.optString("reason", "unknown"));
                    revokedItems.put(revokedItem);
                }
            }

            JSObject result = new JSObject();
            result.put("revoked", revokedItems);
            call.resolve(result);
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "Sync failed.");
        }
    }

    private String activationErrorMessage(Exception e) {
        if (e instanceof SocketTimeoutException) {
            return ACTIVATION_WAKE_MESSAGE;
        }

        if (e instanceof UnknownHostException) {
            return ACTIVATION_ADDRESS_MESSAGE;
        }

        String message = e.getMessage();
        if (message == null || message.trim().isEmpty()) {
            return "Activation failed.";
        }

        String normalized = message.toLowerCase();
        if (normalized.contains("timed out") || normalized.contains("timeout")) {
            return ACTIVATION_WAKE_MESSAGE;
        }

        if (
                normalized.contains("unable to resolve host")
                        || normalized.contains("no address associated with hostname")
                        || normalized.contains("unknownhost")
        ) {
            return ACTIVATION_ADDRESS_MESSAGE;
        }

        return message;
    }
}
