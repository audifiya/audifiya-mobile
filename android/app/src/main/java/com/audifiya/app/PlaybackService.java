package com.audifiya.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Log;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.PlaybackParameters;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import com.getcapacitor.JSObject;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

/**
 * Persistent mediaPlayback foreground service. It owns the ExoPlayer (so the queue advances
 * natively, with no JavaScript involved), the MediaSessionCompat and the one MediaStyle
 * notification (Play/Pause, Previous, Next).
 */
public class PlaybackService extends Service {
    private static final String TAG = "PlaybackService";

    public static final String ACTION_PLAY_PAUSE = "com.audifiya.app.action.PLAY_PAUSE";
    public static final String ACTION_NEXT = "com.audifiya.app.action.NEXT";
    public static final String ACTION_PREVIOUS = "com.audifiya.app.action.PREVIOUS";
    public static final String ACTION_STOP = "com.audifiya.app.action.STOP";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_ARTIST = "artist";

    private static final String CHANNEL_ID = "audifiya_playback";
    private static final int NOTIFICATION_ID = 4711;
    private static final long TICK_MS = 500;

    /** Receives service events (stateChanged, trackChanged, position, ended, error, stopped). */
    public interface Listener {
        void onEvent(String name, JSObject data);
    }

    private static volatile PlaybackService instance;
    private static volatile Listener listener;

    @Nullable
    public static PlaybackService getInstance() {
        return instance;
    }

    public static void setListener(@Nullable Listener l) {
        listener = l;
    }

    /** One playable item sent from JavaScript. */
    public static final class Track {
        public String id = "";
        public String url = "";
        public String title = "";
        public String artist = "";
        public String album = "";
        public String artworkUrl = "";

        public static Track fromJson(JSONObject o) {
            Track t = new Track();
            t.id = o.optString("id", "");
            t.url = o.optString("url", "");
            t.title = o.optString("title", "");
            t.artist = o.optString("artist", "");
            t.album = o.optString("album", "");
            t.artworkUrl = o.optString("artworkUrl", "");
            return t;
        }
    }

    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    /** Parallel to the player's media items. */
    private final List<Track> tracks = new ArrayList<>();

    private ExoPlayer player;
    private MediaSessionCompat session;
    private NotificationManager notificationManager;
    private boolean foregroundStarted = false;

    private String fallbackTitle = "AudiFiya";
    private String fallbackArtist = "Playing music";
    private Bitmap artwork;
    private String artworkUrl;

    private final Runnable ticker = new Runnable() {
        @Override
        public void run() {
            if (player == null) return;
            emitPosition();
            if (isLogicallyPlaying()) main.postDelayed(this, TICK_MS);
        }
    };

    // ---------------------------------------------------------------------------------------
    // Lifecycle
    // ---------------------------------------------------------------------------------------

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        notificationManager = getSystemService(NotificationManager.class);
        createChannel();

        player = new ExoPlayer.Builder(this)
            .setAudioAttributes(
                new AudioAttributes.Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                    .build(),
                /* handleAudioFocus= */ true)
            .setHandleAudioBecomingNoisy(true)
            // Partial CPU wake lock + Wi-Fi lock, held only while playing. Needs WAKE_LOCK.
            .setWakeMode(C.WAKE_MODE_NETWORK)
            .build();
        player.addListener(new PlayerEvents());

        session = new MediaSessionCompat(this, "AudiFiyaPlayback");
        session.setCallback(new MediaSessionCompat.Callback() {
            @Override public void onPlay() { play(); }
            @Override public void onPause() { pause(); }
            @Override public void onSkipToNext() { next(); }
            @Override public void onSkipToPrevious() { previous(); }
            @Override public void onSeekTo(long positionMs) { seekTo(positionMs); }
            @Override public void onStop() { stopPlaybackAndSelf(); }
        });
        session.setActive(true);
        updateSessionState();
    }

    @Override
    public int onStartCommand(@Nullable Intent intent, int flags, int startId) {
        if (intent != null) {
            if (intent.hasExtra(EXTRA_TITLE)) fallbackTitle = intent.getStringExtra(EXTRA_TITLE);
            if (intent.hasExtra(EXTRA_ARTIST)) fallbackArtist = intent.getStringExtra(EXTRA_ARTIST);
        }

        // startForegroundService() requires startForeground() within ~5 s, so do it first.
        if (!ensureForeground()) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String action = intent == null ? null : intent.getAction();
        if (action == null) {
            // null intent = the system restarted us after killing the process; the queue is gone.
            if (intent == null && tracks.isEmpty()) {
                stopPlaybackAndSelf();
                return START_NOT_STICKY;
            }
            updateNotification();
            return START_STICKY;
        }

        switch (action) {
            case ACTION_PLAY_PAUSE:
                if (isLogicallyPlaying()) pause();
                else play();
                break;
            case ACTION_NEXT:
                next();
                break;
            case ACTION_PREVIOUS:
                previous();
                break;
            case ACTION_STOP:
                stopPlaybackAndSelf();
                return START_NOT_STICKY;
            default:
                break;
        }
        return START_STICKY;
    }

    /** The user swiped the app out of the recents list: stop playing and clean up. */
    @Override
    public void onTaskRemoved(Intent rootIntent) {
        stopPlaybackAndSelf();
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        instance = null;
        main.removeCallbacksAndMessages(null);
        io.shutdownNow();
        if (session != null) {
            session.setActive(false);
            session.release();
            session = null;
        }
        if (player != null) {
            player.release();
            player = null;
        }
        if (notificationManager != null) notificationManager.cancel(NOTIFICATION_ID);
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private boolean ensureForeground() {
        if (foregroundStarted) return true;
        try {
            ServiceCompat.startForeground(
                this,
                NOTIFICATION_ID,
                buildNotification(),
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            foregroundStarted = true;
            return true;
        } catch (Exception e) {
            // e.g. started while the app was in the background on Android 12+
            Log.e(TAG, "startForeground failed", e);
            return false;
        }
    }

    private void stopPlaybackAndSelf() {
        main.removeCallbacks(ticker);
        if (player != null) {
            player.stop();
            player.clearMediaItems();
        }
        tracks.clear();
        artwork = null;
        artworkUrl = null;
        emit("stopped", new JSObject());
        if (foregroundStarted) {
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
            foregroundStarted = false;
        }
        stopSelf();
    }

    // ---------------------------------------------------------------------------------------
    // Controls (always called on the main thread)
    // ---------------------------------------------------------------------------------------

    /** Replace the whole queue and start at startIndex. */
    public void setQueue(List<Track> items, int startIndex, long positionMs, boolean autoPlay) {
        if (player == null) return;
        tracks.clear();
        tracks.addAll(items);
        artwork = null;
        artworkUrl = null;
        int index = Math.max(0, Math.min(startIndex, Math.max(0, items.size() - 1)));
        player.setMediaItems(toMediaItems(items), index, positionMs > 0 ? positionMs : C.TIME_UNSET);
        player.prepare();
        player.setPlayWhenReady(autoPlay);
        refreshCurrentTrack();
    }

    /** Append tracks. If the queue had already run dry, playback continues into them. */
    public void addTracks(List<Track> items) {
        if (player == null || items.isEmpty()) return;
        boolean wasEnded = player.getPlaybackState() == Player.STATE_ENDED;
        tracks.addAll(items);
        player.addMediaItems(toMediaItems(items));
        if (wasEnded && player.hasNextMediaItem()) {
            player.seekToNextMediaItem();
            player.play();
        }
    }

    /** Drop everything after the current item (the JS side re-plans what comes next). */
    public void removeUpcoming() {
        if (player == null) return;
        int current = player.getCurrentMediaItemIndex();
        int count = player.getMediaItemCount();
        if (current >= 0 && current + 1 < count) {
            player.removeMediaItems(current + 1, count);
            tracks.subList(Math.min(current + 1, tracks.size()), tracks.size()).clear();
        }
    }

    public void play() {
        if (player == null) return;
        int state = player.getPlaybackState();
        if (state == Player.STATE_ENDED) {
            player.seekToDefaultPosition(player.getCurrentMediaItemIndex());
        } else if (state == Player.STATE_IDLE && player.getMediaItemCount() > 0) {
            player.prepare();
        }
        player.play();
    }

    public void pause() {
        if (player != null) player.pause();
    }

    public void next() {
        if (player != null && player.hasNextMediaItem()) player.seekToNextMediaItem();
    }

    /** Restarts the track if it's more than 3 s in, otherwise goes to the previous one. */
    public void previous() {
        if (player != null) player.seekToPrevious();
    }

    public void seekTo(long positionMs) {
        if (player != null) player.seekTo(Math.max(0, positionMs));
    }

    public void setVolume(float volume) {
        if (player != null) player.setVolume(Math.max(0f, Math.min(1f, volume)));
    }

    public void setRate(float rate) {
        if (player == null) return;
        player.setPlaybackParameters(new PlaybackParameters(Math.max(0.25f, Math.min(4f, rate))));
        updateSessionState();
    }

    /** "one" repeats the current track; anything else is off (JS plans repeat-all itself). */
    public void setRepeatMode(String mode) {
        if (player == null) return;
        player.setRepeatMode("one".equals(mode) ? Player.REPEAT_MODE_ONE : Player.REPEAT_MODE_OFF);
    }

    public void stopService() {
        stopPlaybackAndSelf();
    }

    public JSObject getState() {
        JSObject s = new JSObject();
        if (player == null) return s;
        long duration = player.getDuration();
        s.put("isPlaying", isLogicallyPlaying());
        s.put("state", stateName(player.getPlaybackState()));
        s.put("index", player.getCurrentMediaItemIndex());
        s.put("count", player.getMediaItemCount());
        s.put("positionMs", Math.max(0, player.getCurrentPosition()));
        s.put("durationMs", duration == C.TIME_UNSET ? 0 : Math.max(0, duration));
        return s;
    }

    // ---------------------------------------------------------------------------------------
    // Player events
    // ---------------------------------------------------------------------------------------

    private final class PlayerEvents implements Player.Listener {
        @Override
        public void onIsPlayingChanged(boolean isPlaying) {
            onPlayerStateChanged();
            main.removeCallbacks(ticker);
            if (isLogicallyPlaying()) main.post(ticker);
        }

        @Override
        public void onPlayWhenReadyChanged(boolean playWhenReady, int reason) {
            onPlayerStateChanged();
        }

        @Override
        public void onPlaybackStateChanged(int state) {
            onPlayerStateChanged();
            if (state == Player.STATE_READY) {
                refreshMetadata(); // duration is known now
            } else if (state == Player.STATE_ENDED) {
                emit("ended", new JSObject());
            }
        }

        @Override
        public void onMediaItemTransition(@Nullable MediaItem mediaItem, int reason) {
            refreshCurrentTrack();
            JSObject d = new JSObject();
            Track t = currentTrack();
            d.put("index", player.getCurrentMediaItemIndex());
            d.put("id", t == null ? "" : t.id);
            d.put("reason", reasonName(reason));
            emit("trackChanged", d);
        }

        @Override
        public void onPlayerError(PlaybackException error) {
            Log.e(TAG, "Playback error", error);
            JSObject d = new JSObject();
            d.put("message", String.valueOf(error.getMessage()));
            d.put("code", error.getErrorCodeName());
            emit("error", d);
            // Skip the broken item (e.g. an expired URL) and keep going.
            if (player.hasNextMediaItem()) {
                player.seekToNextMediaItem();
                player.prepare();
                player.play();
            }
        }
    }

    private void onPlayerStateChanged() {
        if (player == null) return;
        updateSessionState();
        updateNotification();
        JSObject d = new JSObject();
        d.put("isPlaying", isLogicallyPlaying());
        d.put("state", stateName(player.getPlaybackState()));
        d.put("index", player.getCurrentMediaItemIndex());
        emit("stateChanged", d);
    }

    private void emitPosition() {
        JSObject d = new JSObject();
        long duration = player.getDuration();
        d.put("positionMs", Math.max(0, player.getCurrentPosition()));
        d.put("durationMs", duration == C.TIME_UNSET ? 0 : Math.max(0, duration));
        d.put("index", player.getCurrentMediaItemIndex());
        emit("position", d);
    }

    private void emit(String name, JSObject data) {
        Listener l = listener;
        if (l != null) {
            try {
                l.onEvent(name, data);
            } catch (Exception e) {
                Log.w(TAG, "Listener failed for " + name, e);
            }
        }
    }

    // ---------------------------------------------------------------------------------------
    // MediaSession + notification
    // ---------------------------------------------------------------------------------------

    private boolean isLogicallyPlaying() {
        if (player == null) return false;
        int state = player.getPlaybackState();
        return player.getPlayWhenReady() && state != Player.STATE_IDLE && state != Player.STATE_ENDED;
    }

    @Nullable
    private Track currentTrack() {
        if (player == null) return null;
        int i = player.getCurrentMediaItemIndex();
        return (i >= 0 && i < tracks.size()) ? tracks.get(i) : null;
    }

    private void refreshCurrentTrack() {
        loadArtwork(currentTrack());
        refreshMetadata();
        updateNotification();
    }

    private void updateSessionState() {
        if (session == null || player == null) return;
        int state = player.getPlaybackState();
        int compat;
        if (state == Player.STATE_BUFFERING) {
            compat = PlaybackStateCompat.STATE_BUFFERING;
        } else if (state == Player.STATE_READY) {
            compat = player.getPlayWhenReady() ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED;
        } else if (state == Player.STATE_ENDED) {
            compat = PlaybackStateCompat.STATE_STOPPED;
        } else {
            compat = tracks.isEmpty() ? PlaybackStateCompat.STATE_NONE : PlaybackStateCompat.STATE_PAUSED;
        }
        long actions = PlaybackStateCompat.ACTION_PLAY
            | PlaybackStateCompat.ACTION_PAUSE
            | PlaybackStateCompat.ACTION_PLAY_PAUSE
            | PlaybackStateCompat.ACTION_SKIP_TO_NEXT
            | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
            | PlaybackStateCompat.ACTION_SEEK_TO
            | PlaybackStateCompat.ACTION_STOP;
        session.setPlaybackState(
            new PlaybackStateCompat.Builder()
                .setActions(actions)
                .setState(compat, Math.max(0, player.getCurrentPosition()), player.getPlaybackParameters().speed)
                .build());
    }

    private void refreshMetadata() {
        if (session == null || player == null) return;
        Track t = currentTrack();
        MediaMetadataCompat.Builder b = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, t != null ? t.title : fallbackTitle)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, t != null ? t.artist : fallbackArtist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, t != null ? t.album : "");
        long duration = player.getDuration();
        if (duration != C.TIME_UNSET && duration > 0) {
            b.putLong(MediaMetadataCompat.METADATA_KEY_DURATION, duration);
        }
        if (artwork != null) b.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, artwork);
        session.setMetadata(b.build());
    }

    private void updateNotification() {
        if (!foregroundStarted || notificationManager == null) return;
        notificationManager.notify(NOTIFICATION_ID, buildNotification());
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Music playback", NotificationManager.IMPORTANCE_LOW);
        channel.setShowBadge(false);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        notificationManager.createNotificationChannel(channel);
    }

    private PendingIntent actionIntent(String action, int requestCode) {
        Intent i = new Intent(this, PlaybackService.class).setAction(action);
        return PendingIntent.getService(this, requestCode, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private Notification buildNotification() {
        Track t = currentTrack();
        String title = (t != null && !t.title.isEmpty()) ? t.title : fallbackTitle;
        String artist = (t != null && !t.artist.isEmpty()) ? t.artist : fallbackArtist;
        boolean playing = isLogicallyPlaying();

        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent contentIntent = open == null
            ? null
            : PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle(title)
            .setContentText(artist)
            .setLargeIcon(artwork)
            .setContentIntent(contentIntent)
            .setDeleteIntent(actionIntent(ACTION_STOP, 4))
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setOngoing(playing)
            .addAction(new NotificationCompat.Action.Builder(
                android.R.drawable.ic_media_previous, "Previous", actionIntent(ACTION_PREVIOUS, 1)).build())
            .addAction(new NotificationCompat.Action.Builder(
                playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                playing ? "Pause" : "Play",
                actionIntent(ACTION_PLAY_PAUSE, 2)).build())
            .addAction(new NotificationCompat.Action.Builder(
                android.R.drawable.ic_media_next, "Next", actionIntent(ACTION_NEXT, 3)).build());

        if (session != null) {
            b.setStyle(new androidx.media.app.NotificationCompat.MediaStyle()
                .setMediaSession(session.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2));
        }
        return b.build();
    }

    // ---------------------------------------------------------------------------------------
    // Artwork
    // ---------------------------------------------------------------------------------------

    private void loadArtwork(@Nullable Track t) {
        final String url = (t == null) ? null : t.artworkUrl;
        if (url == null || url.isEmpty()) {
            artwork = null;
            artworkUrl = null;
            return;
        }
        if (url.equals(artworkUrl)) return; // already loaded (or loading) for this URL
        artwork = null;
        artworkUrl = url;
        io.execute(() -> {
            final Bitmap bitmap = download(url);
            main.post(() -> {
                if (player == null) return;
                Track current = currentTrack();
                if (current == null || !url.equals(current.artworkUrl)) return; // track changed meanwhile
                if (bitmap == null) {
                    if (url.equals(artworkUrl)) artworkUrl = null; // allow a retry later
                    return;
                }
                artwork = bitmap;
                refreshMetadata();
                updateNotification();
            });
        });
    }

    @Nullable
    private static Bitmap download(String url) {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setConnectTimeout(8000);
            connection.setReadTimeout(8000);
            try (InputStream in = connection.getInputStream()) {
                return BitmapFactory.decodeStream(in);
            }
        } catch (Exception e) {
            Log.w(TAG, "Artwork download failed: " + url, e);
            return null;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    // ---------------------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------------------

    private static List<MediaItem> toMediaItems(List<Track> items) {
        List<MediaItem> out = new ArrayList<>(items.size());
        for (Track t : items) {
            out.add(new MediaItem.Builder().setUri(t.url).setMediaId(t.id).build());
        }
        return out;
    }

    private static String stateName(int state) {
        switch (state) {
            case Player.STATE_BUFFERING: return "buffering";
            case Player.STATE_READY: return "ready";
            case Player.STATE_ENDED: return "ended";
            default: return "idle";
        }
    }

    private static String reasonName(int reason) {
        switch (reason) {
            case Player.MEDIA_ITEM_TRANSITION_REASON_AUTO: return "auto";
            case Player.MEDIA_ITEM_TRANSITION_REASON_SEEK: return "seek";
            case Player.MEDIA_ITEM_TRANSITION_REASON_REPEAT: return "repeat";
            default: return "playlist";
        }
    }
}
