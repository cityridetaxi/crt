package com.cityride.driver.plugins;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BackgroundLocationPlugin")
public class BackgroundLocationPlugin extends Plugin {

    @PluginMethod
    public void promptEnableLocation(PluginCall call) {
        // Implementation for enabling location
        call.resolve();
    }
}
