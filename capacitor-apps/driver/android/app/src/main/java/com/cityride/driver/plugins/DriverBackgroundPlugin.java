package com.cityride.driver.plugins;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.os.PowerManager;
import android.content.Context;
import com.cityride.driver.FloatingWidgetService;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DriverBackgroundPlugin")
public class DriverBackgroundPlugin extends Plugin {

    @PluginMethod
    public void checkOverlayPermission(PluginCall call) {
        JSObject ret = new JSObject();
        boolean granted = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            granted = Settings.canDrawOverlays(getContext());
        }
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestOverlayPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(getContext())) {
            Intent intent = new Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + getContext().getPackageName())
            );
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }
        JSObject ret = new JSObject();
        ret.put("requested", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void startDuty(PluginCall call) {
        showFloatingWidget(call);
    }

    @PluginMethod
    public void stopDuty(PluginCall call) {
        hideFloatingWidget(call);
    }

    @PluginMethod
    public void showFloatingWidget(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), FloatingWidgetService.class);
            intent.setAction("SHOW_BUBBLE");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to start floating widget: " + e.getMessage());
        }
    }

    @PluginMethod
    public void hideFloatingWidget(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), FloatingWidgetService.class);
            intent.setAction("HIDE_BUBBLE");
            getContext().stopService(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to stop floating widget: " + e.getMessage());
        }
    }

    @PluginMethod
    public void showFloatingRidePing(PluginCall call) {
        String bookingId = call.getString("bookingId", "");
        String pickup = call.getString("pickup", "Pickup");
        String drop = call.getString("drop", "Dropoff");
        String fare = call.getString("fare", "0");

        try {
            Intent intent = new Intent(getContext(), FloatingWidgetService.class);
            intent.setAction("SHOW_PING");
            intent.putExtra("bookingId", bookingId);
            intent.putExtra("pickup", pickup);
            intent.putExtra("drop", drop);
            intent.putExtra("fare", fare);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to show ping overlay: " + e.getMessage());
        }
    }

    @PluginMethod
    public void hideFloatingRidePing(PluginCall call) {
        hideFloatingWidget(call);
    }

    @PluginMethod
    public void setActiveTrip(PluginCall call) {
        call.resolve();
    }

    @PluginMethod
    public void clearActiveTrip(PluginCall call) {
        call.resolve();
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            if (pm != null && !pm.isIgnoringBatteryOptimizations(getContext().getPackageName())) {
                Intent intent = new Intent();
                intent.setAction(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            }
        }
        call.resolve();
    }
}
