package com.menugx.app;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/** Memilih menu yang ditampilkan widget dari data bulanan (format sama dengan menu.json). */
public final class MenuData {

    static final String[] MEALS = { "pagi", "siang", "sore" };
    static final String[] LABELS = { "Pagi", "Siang", "Sore" };
    // Batas jam makan (menit sejak 00:00), sama dengan NOW_SLOTS di www/app.js
    static final int[] SLOT_END = { 10 * 60, 15 * 60, 24 * 60 };
    // Mulai jam ini widget menampilkan menu besok
    static final int SHOW_TOMORROW_FROM = 20 * 60;

    private static final String[] HARI = { "Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu" };
    private static final String[] BULAN = { "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des" };

    public static final class Meal {
        public final String label;
        /** Jenis nasi ("Nasi Putih", "Nasi Kuning", …); kosong kalau tidak ada */
        public final String rice;
        /** Nasi selain nasi putih → ditonjolkan */
        public final boolean riceSpecial;
        /** Lauk utama (baris kedua di Excel), satu item per masakan */
        public final List<String> mains;
        /** Pelengkap: sayur, sambal, kerupuk, … */
        public final List<String> sides;
        public final boolean current;

        Meal(String label, String rice, List<String> mains, List<String> sides, boolean current) {
            this.label = label;
            this.rice = rice;
            this.riceSpecial = !rice.isEmpty() && !rice.equalsIgnoreCase("Nasi Putih");
            this.mains = mains;
            this.sides = sides;
            this.current = current;
        }
    }

    public static final class Content {
        public String title;
        public String rel;
        /** Selalu 3 slot (pagi, siang, sore), slot kosong = null; seluruhnya null kalau tanggal ini belum ada menunya */
        public Meal[] meals;
    }

    private MenuData() {}

    /** Waktu (epoch ms) berikutnya tampilan widget perlu berubah: ganti jam makan, menu besok, atau ganti hari. */
    static long nextChangeAt(Calendar now) {
        int min = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);
        int[] marks = { SLOT_END[0], SLOT_END[1], SHOW_TOMORROW_FROM, 24 * 60 };
        Calendar next = (Calendar) now.clone();
        next.set(Calendar.SECOND, 5);
        next.set(Calendar.MILLISECOND, 0);
        for (int m : marks) {
            if (m > min) {
                next.set(Calendar.HOUR_OF_DAY, 0);
                next.set(Calendar.MINUTE, 0);
                next.add(Calendar.MINUTE, m);
                return next.getTimeInMillis();
            }
        }
        return now.getTimeInMillis() + 30 * 60 * 1000L;
    }

    public static Content build(JSONObject months, Calendar now) {
        int min = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);
        Calendar day = (Calendar) now.clone();
        boolean tomorrow = min >= SHOW_TOMORROW_FROM;
        if (tomorrow) day.add(Calendar.DAY_OF_MONTH, 1);

        JSONObject menu = find(months, day);
        if (tomorrow && menu == null) {
            // Menu besok belum ada → tetap tampilkan hari ini
            day = (Calendar) now.clone();
            menu = find(months, day);
            tomorrow = false;
        }

        Content c = new Content();
        c.rel = tomorrow ? "Besok" : "Hari ini";
        c.title = HARI[day.get(Calendar.DAY_OF_WEEK) - 1] + ", " + day.get(Calendar.DAY_OF_MONTH) + " " + BULAN[day.get(Calendar.MONTH)];
        if (menu == null) return c;

        int slot = 0;
        if (!tomorrow) {
            while (slot < SLOT_END.length - 1 && min >= SLOT_END[slot]) slot++;
        }
        // Jam makan yang disorot: slot sekarang, atau berikutnya kalau slot ini kosong
        int current = -1;
        for (int i = slot; i < MEALS.length && current < 0; i++) if (hasRows(menu, i)) current = i;
        for (int i = slot - 1; i >= 0 && current < 0; i--) if (hasRows(menu, i)) current = i;
        if (current < 0) return c;

        c.meals = new Meal[MEALS.length];
        for (int i = 0; i < MEALS.length; i++) {
            if (hasRows(menu, i)) c.meals[i] = toMeal(LABELS[i], menu.optJSONArray(MEALS[i]), i == current);
        }
        return c;
    }

    private static boolean hasRows(JSONObject menu, int meal) {
        JSONArray rows = menu.optJSONArray(MEALS[meal]);
        return rows != null && rows.length() > 0;
    }

    static String key(Calendar d) {
        return String.format(Locale.US, "%04d-%02d-%02d", d.get(Calendar.YEAR), d.get(Calendar.MONTH) + 1, d.get(Calendar.DAY_OF_MONTH));
    }

    private static JSONObject find(JSONObject months, Calendar d) {
        if (months == null) return null;
        String k = key(d);
        JSONObject month = months.optJSONObject(k.substring(0, 7));
        JSONObject days = month == null ? null : month.optJSONObject("days");
        return days == null ? null : days.optJSONObject(k);
    }

    // Baris pertama berisi nasi → dipisah; baris berikutnya lauk utama; sisanya pelengkap
    private static Meal toMeal(String label, JSONArray rows, boolean current) {
        int start = 0;
        String rice = null;
        JSONArray first = rows.optJSONArray(0);
        if (first != null && first.length() > 0 && allRice(first)) {
            rice = join(first, " / ");
            start = 1;
        }
        List<String> mains = new ArrayList<>();
        if (start < rows.length()) addItems(mains, rows.optJSONArray(start));
        List<String> sides = new ArrayList<>();
        for (int r = start + 1; r < rows.length(); r++) addItems(sides, rows.optJSONArray(r));
        return new Meal(label, rice == null ? "" : rice, mains, sides, current);
    }

    private static void addItems(List<String> out, JSONArray row) {
        if (row == null) return;
        for (int i = 0; i < row.length(); i++) {
            String s = row.optString(i).trim();
            if (!s.isEmpty()) out.add(s);
        }
    }

    private static boolean allRice(JSONArray row) {
        for (int i = 0; i < row.length(); i++) {
            if (!row.optString(i).toLowerCase(Locale.ROOT).matches("^nasi\\b.*")) return false;
        }
        return true;
    }

    private static String join(JSONArray row, String sep) {
        if (row == null) return "";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < row.length(); i++) {
            String s = row.optString(i).trim();
            if (s.isEmpty()) continue;
            if (sb.length() > 0) sb.append(sep);
            sb.append(s);
        }
        return sb.toString();
    }
}
