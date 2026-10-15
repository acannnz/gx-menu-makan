package com.menugx.app;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Intent;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Jembatan dari web app (www/app.js) ke Android: data widget, pasang widget, bagikan teks. */
@CapacitorPlugin(name = "MenuGX")
public class MenuGXPlugin extends Plugin {

    @PluginMethod
    public void setMenu(PluginCall call) {
        String months = call.getString("months");
        if (months == null) {
            call.reject("Data menu kosong");
            return;
        }
        MenuStore.save(getContext(), months);
        MenuWidgetProvider.refreshAll(getContext());
        JSObject ret = new JSObject();
        ret.put("widgets", MenuWidgetProvider.count(getContext()));
        ret.put("canPin", canPin());
        call.resolve(ret);
    }

    @PluginMethod
    public void pinWidget(PluginCall call) {
        boolean ok = false;
        if (canPin()) {
            AppWidgetManager mgr = getContext().getSystemService(AppWidgetManager.class);
            ok = mgr.requestPinAppWidget(new ComponentName(getContext(), MenuWidgetProvider.class), null, null);
        }
        JSObject ret = new JSObject();
        ret.put("ok", ok);
        call.resolve(ret);
    }

    @PluginMethod
    public void share(PluginCall call) {
        Intent send = new Intent(Intent.ACTION_SEND)
            .setType("text/plain")
            .putExtra(Intent.EXTRA_TEXT, call.getString("text", ""));
        getActivity().startActivity(Intent.createChooser(send, "Bagikan menu"));
        call.resolve();
    }

    private boolean canPin() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false;
        AppWidgetManager mgr = getContext().getSystemService(AppWidgetManager.class);
        return mgr != null && mgr.isRequestPinAppWidgetSupported();
    }
}
