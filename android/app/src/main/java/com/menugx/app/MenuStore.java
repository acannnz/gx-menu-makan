package com.menugx.app;

import android.content.Context;
import android.content.SharedPreferences;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/** Data menu untuk widget: dikirim dari aplikasi (setMenu), atau menu.json bawaan APK sebagai cadangan. */
final class MenuStore {

    private static final String PREFS = "menugx";
    private static final String KEY_MONTHS = "months";

    private MenuStore() {}

    static void save(Context ctx, String monthsJson) {
        prefs(ctx).edit().putString(KEY_MONTHS, monthsJson).apply();
    }

    static JSONObject load(Context ctx) {
        String saved = prefs(ctx).getString(KEY_MONTHS, null);
        if (saved != null) {
            try {
                return new JSONObject(saved);
            } catch (Exception ignored) {
                // data rusak → pakai bawaan
            }
        }
        try (InputStream in = ctx.getAssets().open("public/menu.json")) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            JSONObject root = new JSONObject(new String(out.toByteArray(), StandardCharsets.UTF_8));
            JSONObject months = root.optJSONObject("months");
            return months != null ? months : new JSONObject();
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
