import { getAudio } from "@/lib/remote-audio";
import { useEffect } from "react";
import { usePlayback } from "@/lib/playback-engine";
import { getArtistString, getThumbnail } from "@/lib/jiosaavn";
import { decodeEntities } from "@/lib/utils";

/**
 * Keeps the browser tab title and the OS media notification (lock screen,
 * media keys) in sync with the currently playing track.
 */
export function useMediaSession() {
  const currentTrack = usePlayback((s) => s.currentTrack);
  const isPlaying = usePlayback((s) => s.isPlaying);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const title = currentTrack ? decodeEntities(currentTrack.name) : null;
    document.title = title ? `${title} - AudiFiya` : "AudiFiya";

    if (!("mediaSession" in navigator)) return;
    if (!currentTrack) {
      navigator.mediaSession.metadata = null;
      return;
    }

    const art = getThumbnail(currentTrack);
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title ?? "",
        artist: getArtistString(currentTrack),
        album: currentTrack.album?.name
          ? decodeEntities(currentTrack.album.name)
          : "AudiFiya",
        artwork: [
          { src: art, sizes: "500x500", type: "image/jpeg" },
          { src: art, sizes: "150x150", type: "image/jpeg" },
        ],
      });
    } catch {
      /* noop */
    }

    const audio = () =>
      getAudio();

    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => audio()?.play().catch(() => {})],
      ["pause", () => audio()?.pause()],
      ["previoustrack", () => usePlayback.getState().prev()],
      ["nexttrack", () => usePlayback.getState().next()],
      [
        "seekto",
        (details) => {
          const el = audio();
          if (el && typeof details.seekTime === "number") {
            el.currentTime = details.seekTime;
          }
        },
      ],
    ];

    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        /* unsupported action */
      }
    }

    return () => {
      for (const [action] of handlers) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          /* noop */
        }
      }
    };
  }, [currentTrack]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);
}
