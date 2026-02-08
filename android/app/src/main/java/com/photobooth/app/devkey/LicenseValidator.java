package com.photobooth.app.devkey;

public class LicenseValidator {

    private static final String SECRET = "ICHIWOAH_PHOTOBOOTH_10111996";

    public static boolean check(String deviceId, String licenseKey) {

        String raw = deviceId + SECRET;
        String hash = HashHelper.hash(raw);
        String expected = hash.substring(0, 20).toUpperCase();
        String finalKey = "PB-" + expected;

        return licenseKey.equals(finalKey);
    }
}
