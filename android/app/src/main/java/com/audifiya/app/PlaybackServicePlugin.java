// Same package and folder as PlaybackService.java.
package com.example.app;

import android.content.Intent;
import androidx.core.content.ContextCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "PlaybackService")
public class PlaybackServicePlugin extends Plugin {
    @PluginMethod
    public void start(PluginCall call) {
        ContextCompat.startForegroundService(getContext(), new Intent(getContext(), PlaybackService.class));
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), PlaybackService.class));
        call.resolve();
    }
}
