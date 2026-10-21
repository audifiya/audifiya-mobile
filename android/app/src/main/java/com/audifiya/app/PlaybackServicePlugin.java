package com.audifiya.app;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONException;

/**
 * JavaScript bridge to PlaybackService.
 *
 * Methods: startService, stopService, setQueue, addTracks, removeUpcoming, play, pause, next,
 * previous, seekTo, setVolume, setRate, setRepeatMode, getState, requestNotificationPermission.
 * Events: stateChanged, trackChanged, position, ended, error, stopped.
 */
@CapacitorPlugin(
    name = "PlaybackService",
    permissions = { @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications") }
)
public class PlaybackServicePlugin extends Plugin {
    private static final long START_TIMEOUT_MS = 3000;

    private final Handler main = new Handler(Looper.getMainLooper());

    private interface ServiceTask {
        /** Runs on the main thread. May return data for the JS caller, or null. */
        JSObject run(PlaybackService service) throws Exception;
    }

    @Override
    public void load() {
        PlaybackService.setListener((name, data) -> notifyListeners(name, data));
    }

    @Override
    protected void handleOnDestroy() {
        PlaybackService.setListener(null);
    }

    // ---------------------------------------------------------------------------------------
    // Service lifecycle
    // ---------------------------------------------------------------------------------------

    /** startService({ title?, artist? }) - starts the sticky foreground service and its notification. */
    @PluginMethod
    public void startService(PluginCall call) {
        try {
            launchService(call.getString("title"), call.getString("artist"));
        } catch (Exception e) {
            call.reject("Could not start the playback service: " + e.getMessage(), e);
            return;
        }
        awaitService(call, service -> null, SystemClock.uptimeMillis() + START_TIMEOUT_MS);
    }

    /** stopService() - stops playback, removes the notification and stops the service. */
    @PluginMethod
    public void stopService(PluginCall call) {
        if (PlaybackService.getInstance() == null) {
            call.resolve();
            return;
        }
        withService(call, false, service -> {
            service.stopService();
            return null;
        });
    }

    // ---------------------------------------------------------------------------------------
    // Queue + transport
    // ---------------------------------------------------------------------------------------

    /** setQueue({ tracks, startIndex?, positionMs?, autoPlay? }) - replaces the native queue. */
    @PluginMethod
    public void setQueue(PluginCall call) {
        final List<PlaybackService.Track> tracks;
        try {
            tracks = parseTracks(call);
        } catch (JSONException e) {
            call.reject("Invalid tracks: " + e.getMessage());
            return;
        }
        final int startIndex = call.getInt("startIndex", 0);
        final long positionMs = call.getData().optLong("positionMs", 0);
        final boolean autoPlay = call.getBoolean("autoPlay", true);
        withService(call, true, service -> {
            service.setQueue(tracks, startIndex, positionMs, autoPlay);
            return null;
        });
    }

    /** addTracks({ tracks }) - appends to the queue (also used for "play next" / radio top-ups). */
    @PluginMethod
    public void addTracks(PluginCall call) {
        final List<PlaybackService.Track> tracks;
        try {
            tracks = parseTracks(call);
        } catch (JSONException e) {
            call.reject("Invalid tracks: " + e.getMessage());
            return;
        }
        withService(call, false, service -> {
            service.addTracks(tracks);
            return null;
        });
    }

    @PluginMethod
    public void removeUpcoming(PluginCall call) {
        withService(call, false, service -> {
            service.removeUpcoming();
            return null;
        });
    }

    @PluginMethod
    public void play(PluginCall call) {
        withService(call, false, service -> {
            service.play();
            return null;
        });
    }

    @PluginMethod
    public void pause(PluginCall call) {
        withService(call, false, service -> {
            service.pause();
            return null;
        });
    }

    @PluginMethod
    public void next(PluginCall call) {
        withService(call, false, service -> {
            service.next();
            return null;
        });
    }

    @PluginMethod
    public void previous(PluginCall call) {
        withService(call, false, service -> {
            service.previous();
            return null;
        });
    }

    @PluginMethod
    public void seekTo(PluginCall call) {
        final long positionMs = call.getData().optLong("positionMs", 0);
        withService(call, false, service -> {
            service.seekTo(positionMs);
            return null;
        });
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        final float volume = call.getFloat("volume", 1f);
        withService(call, false, service -> {
            service.setVolume(volume);
            return null;
        });
    }

    @PluginMethod
    public void setRate(PluginCall call) {
        final float rate = call.getFloat("rate", 1f);
        withService(call, false, service -> {
            service.setRate(rate);
            return null;
        });
    }

    /** setRepeatMode({ mode: "off" | "one" }) */
    @PluginMethod
    public void setRepeatMode(PluginCall call) {
        final String mode = call.getString("mode", "off");
        withService(call, false, service -> {
            service.setRepeatMode(mode);
            return null;
        });
    }

    @PluginMethod
    public void getState(PluginCall call) {
        withService(call, false, PlaybackService::getState);
    }

    // ---------------------------------------------------------------------------------------
    // Android 13+ notification permission
    // ---------------------------------------------------------------------------------------

    /** requestNotificationPermission() -> { granted } ; without it Android 13+ hides the notification. */
    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
            || getPermissionState("notifications") == PermissionState.GRANTED) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationPermissionCallback");
    }

    @PermissionCallback
    private void notificationPermissionCallback(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", getPermissionState("notifications") == PermissionState.GRANTED);
        call.resolve(result);
    }

    // ---------------------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------------------

    private void launchService(String title, String artist) {
        Intent intent = new Intent(getContext(), PlaybackService.class);
        if (title != null) intent.putExtra(PlaybackService.EXTRA_TITLE, title);
        if (artist != null) intent.putExtra(PlaybackService.EXTRA_ARTIST, artist);
        ContextCompat.startForegroundService(getContext(), intent);
    }

    /** Runs the task on the main thread once the service exists, starting it first if allowed. */
    private void withService(final PluginCall call, boolean autoStart, final ServiceTask task) {
        if (PlaybackService.getInstance() == null) {
            if (!autoStart) {
                call.reject("Playback service is not running");
                return;
            }
            try {
                launchService(null, null);
            } catch (Exception e) {
                call.reject("Could not start the playback service: " + e.getMessage(), e);
                return;
            }
        }
        awaitService(call, task, SystemClock.uptimeMillis() + START_TIMEOUT_MS);
    }

    private void awaitService(final PluginCall call, final ServiceTask task, final long deadline) {
        main.post(() -> {
            PlaybackService service = PlaybackService.getInstance();
            if (service != null) {
                try {
                    JSObject result = task.run(service);
                    if (result != null) call.resolve(result);
                    else call.resolve();
                } catch (Exception e) {
                    call.reject(e.getMessage(), e);
                }
                return;
            }
            if (SystemClock.uptimeMillis() > deadline) {
                call.reject("Playback service did not start in time");
                return;
            }
            main.postDelayed(() -> awaitService(call, task, deadline), 50);
        });
    }

    private List<PlaybackService.Track> parseTracks(PluginCall call) throws JSONException {
        JSONArray array = call.getArray("tracks");
        if (array == null) throw new JSONException("tracks is required");
        List<PlaybackService.Track> out = new ArrayList<>(array.length());
        for (int i = 0; i < array.length(); i++) {
            out.add(PlaybackService.Track.fromJson(array.getJSONObject(i)));
        }
        return out;
    }
}
