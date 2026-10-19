// Replace the package with your app's package (the appId in capacitor.config.ts),
// and put this file in android/app/src/main/java/<your/package/path>/
package com.example.app;
import com.audifiya.app.R;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;

/**
 * Foreground service of type mediaPlayback. @capgo/capacitor-native-audio plays the
 * audio and shows the media notification, but does not create this service; without
 * it Android stops playback shortly after the screen locks.
 */
public class PlaybackService extends Service {
    private static final String CHANNEL_ID = "playback";

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Playback", NotificationManager.IMPORTANCE_LOW);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("AudiFiya")
            .setContentText("Playing music")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(1, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(1, notification);
        }
        return START_NOT_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
