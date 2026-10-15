package com.menugx.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Paint;
import android.os.Bundle;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.LeadingMarginSpan;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;

/** Widget layar utama: 3 kolom Pagi | Siang | Sore untuk hari ini (atau besok setelah jam 20.00). */
public class MenuWidgetProvider extends AppWidgetProvider {

    static final String ACTION_REFRESH = "com.menugx.app.WIDGET_REFRESH";

    private static final int[] COLS = { R.id.w_col_0, R.id.w_col_1, R.id.w_col_2 };
    private static final int[] DOTS = { R.id.w_dot_0, R.id.w_dot_1, R.id.w_dot_2 };
    private static final int[] RICES = { R.id.w_rice_0, R.id.w_rice_1, R.id.w_rice_2 };
    private static final int[] RICES_SPECIAL = { R.id.w_rice_sp_0, R.id.w_rice_sp_1, R.id.w_rice_sp_2 };
    private static final int[] MAINS = { R.id.w_main_0, R.id.w_main_1, R.id.w_main_2 };
    private static final int[] SIDES = { R.id.w_side_0, R.id.w_side_1, R.id.w_side_2 };
    private static final int[] COL_NOW = { R.drawable.widget_col_pagi_now, R.drawable.widget_col_siang_now, R.drawable.widget_col_sore_now };

    // Ukuran teks daftar masakan, sama dengan widget_menu.xml (untuk menghitung indentasi bullet)
    private static final float MAIN_SP = 12f;
    private static final float SIDE_SP = 11f;
    private static final String BULLET = "• ";

    static void refreshAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, MenuWidgetProvider.class));
        for (int id : ids) update(ctx, mgr, id);
        scheduleNext(ctx, ids.length > 0);
    }

    static int count(Context ctx) {
        return AppWidgetManager.getInstance(ctx).getAppWidgetIds(new ComponentName(ctx, MenuWidgetProvider.class)).length;
    }

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) update(ctx, mgr, id);
        scheduleNext(ctx, true);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context ctx, AppWidgetManager mgr, int id, Bundle options) {
        update(ctx, mgr, id);
    }

    @Override
    public void onDisabled(Context ctx) {
        scheduleNext(ctx, false);
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        super.onReceive(ctx, intent);
        String action = intent.getAction();
        if (ACTION_REFRESH.equals(action)
            || Intent.ACTION_TIME_CHANGED.equals(action)
            || Intent.ACTION_TIMEZONE_CHANGED.equals(action)) {
            refreshAll(ctx);
        }
    }

    private static void update(Context ctx, AppWidgetManager mgr, int id) {
        RemoteViews v = buildViews(ctx, MenuData.build(MenuStore.load(ctx), Calendar.getInstance()));
        Intent open = new Intent(ctx, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.w_root, pi);
        mgr.updateAppWidget(id, v);
    }

    static RemoteViews buildViews(Context ctx, MenuData.Content c) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_menu);
        v.setTextViewText(R.id.w_title, c.title);
        v.setTextViewText(R.id.w_rel, c.rel.toUpperCase(Locale.ROOT));

        MenuData.Meal[] meals = c.meals;
        v.setViewVisibility(R.id.w_cols, meals == null ? View.GONE : View.VISIBLE);
        v.setViewVisibility(R.id.w_empty, meals == null ? View.VISIBLE : View.GONE);
        for (int i = 0; i < COLS.length; i++) {
            MenuData.Meal m = meals != null ? meals[i] : null;
            v.setViewVisibility(COLS[i], m != null ? View.VISIBLE : View.GONE);
            if (m == null) continue;

            // Kolom jam makan saat ini: latar berwarna + garis tepi + titik
            v.setInt(COLS[i], "setBackgroundResource", m.current ? COL_NOW[i] : R.drawable.widget_col);
            v.setViewVisibility(DOTS[i], m.current ? View.VISIBLE : View.GONE);

            // Jenis nasi; selain nasi putih ditulis tebal dengan warna jam makan
            v.setTextViewText(m.riceSpecial ? RICES_SPECIAL[i] : RICES[i], m.rice);
            v.setViewVisibility(RICES[i], !m.rice.isEmpty() && !m.riceSpecial ? View.VISIBLE : View.GONE);
            v.setViewVisibility(RICES_SPECIAL[i], m.riceSpecial ? View.VISIBLE : View.GONE);

            setList(ctx, v, MAINS[i], m.mains, MAIN_SP);
            setList(ctx, v, SIDES[i], m.sides, SIDE_SP);
        }
        return v;
    }

    // Satu masakan per baris dengan bullet; baris lanjutan menjorok supaya tiap masakan tetap terbaca terpisah
    private static void setList(Context ctx, RemoteViews v, int viewId, List<String> items, float sp) {
        v.setViewVisibility(viewId, items.isEmpty() ? View.GONE : View.VISIBLE);
        if (items.isEmpty()) return;
        Paint paint = new Paint();
        paint.setTextSize(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, sp, ctx.getResources().getDisplayMetrics()));
        int indent = Math.round(paint.measureText(BULLET));

        SpannableStringBuilder sb = new SpannableStringBuilder();
        for (int i = 0; i < items.size(); i++) {
            int start = sb.length();
            sb.append(BULLET).append(items.get(i));
            if (i < items.size() - 1) sb.append('\n');
            sb.setSpan(new LeadingMarginSpan.Standard(0, indent), start, sb.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        }
        v.setTextViewText(viewId, sb);
    }

    // Segarkan tepat saat jam makan berganti / ganti hari (selain updatePeriodMillis 30 menit)
    private static void scheduleNext(Context ctx, boolean enabled) {
        AlarmManager am = ctx.getSystemService(AlarmManager.class);
        if (am == null) return;
        Intent i = new Intent(ctx, MenuWidgetProvider.class).setAction(ACTION_REFRESH);
        PendingIntent pi = PendingIntent.getBroadcast(ctx, 1, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        am.cancel(pi);
        if (enabled) am.set(AlarmManager.RTC, MenuData.nextChangeAt(Calendar.getInstance()), pi);
    }
}
