import { useAccount } from "@/lib/account";
import { BannedScreen, UsernamePrompt } from "@/components/AccountGate";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Sidebar } from "@/components/Sidebar";
import { MobileTabBar } from "@/components/MobileTabBar";
import { PlayerBar } from "@/components/PlayerBar";
import { MiniPlayer } from "@/components/MiniPlayer";
import { ExpandedPlayer } from "@/components/ExpandedPlayer";
import { ArtistOverlay } from "@/components/ArtistOverlay";
import { OnboardingModal } from "@/components/OnboardingModal";
import { Toaster } from "@/components/ui/sonner";
import { FeedbackWidget } from "@/components/FeedbackModal";
import { useProfile } from "@/lib/user-profile";
import { importPlaylistFromToken } from "@/lib/library";
import { usePlayback, formatTime } from "@/lib/playback-engine";
import { useArtistView } from "@/lib/artist-view";
import { useThemeMode } from "@/lib/theme-mode";
import { useMediaSession } from "@/lib/media-session";
import {
  Play,
  Pause,
  Maximize2,
  Minimize2,
  SkipBack,
  SkipForward,
  X,
  Square,
  Minus,
} from "lucide-react";
import { getThumbnail } from "@/lib/jiosaavn";
import { SafeImage, resolveImageUrl } from "@/components/SafeImage";
import { setNativeStatusBarStyle } from "@/lib/native-chrome";

declare global {
  interface Window {
    electronAPI?: {
      minimizeToNotch: () => void;
      restoreWindow: () => void;
      minimizeWindow: () => void;
      maximizeWindow: () => void;
      closeWindow: () => void;
    };
  }
}

/* -------------------------------------------------------------------------- */
/*  Desktop (Electron) helpers                                                */
/* -------------------------------------------------------------------------- */

const DRAG = { WebkitAppRegion: "drag" } as CSSProperties;
const NO_DRAG = { WebkitAppRegion: "no-drag" } as CSSProperties;

const detectDesktop = () => typeof window !== "undefined" && Boolean(window.electronAPI);
const subscribeNoop = () => () => {};

/**
 * Hydration-safe desktop detection: the server snapshot is always `false`,
 * the client snapshot checks for the Electron preload bridge.
 */
function useIsDesktop() {
  return useSyncExternalStore(subscribeNoop, detectDesktop, () => false);
}

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60";

/* -------------------------------------------------------------------------- */
/*  Image safety: SafeImage / resolveImageUrl live in @/components/SafeImage  */
/* -------------------------------------------------------------------------- */

function safeThumbnail(track: unknown): string | null {
  if (!track) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return resolveImageUrl(getThumbnail(track as any));
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  Title bar                                                                 */
/* -------------------------------------------------------------------------- */

const CAPTION_BTN =
  "flex h-full w-[46px] items-center justify-center text-white/70 transition-colors hover:bg-white/10 hover:text-white " +
  FOCUS_RING;

function DesktopTitleBar({ onNotch }: { onNotch: () => void }) {
  return (
    <div
      className="absolute inset-x-0 top-0 z-[9999] flex h-[38px] select-none items-stretch justify-between border-b border-white/5 bg-black/50 backdrop-blur-md"
      style={DRAG}
    >
      <span className="flex items-center pl-4 text-[11px] font-medium tracking-wide text-white/60">
        AudiFiya
      </span>

      <div className="flex items-stretch" style={NO_DRAG}>
        <button
          type="button"
          onClick={onNotch}
          title="Switch to notch mode"
          className={`my-auto mr-2 flex h-6 items-center gap-1.5 rounded-full bg-white/10 px-3 text-[11px] font-semibold text-white/80 transition-colors hover:bg-white/20 hover:text-white ${FOCUS_RING}`}
        >
          <Minimize2 size={12} />
          Mini player
        </button>

        <button
          type="button"
          aria-label="Minimize"
          onClick={() => window.electronAPI?.minimizeWindow()}
          className={CAPTION_BTN}
        >
          <Minus size={15} />
        </button>
        <button
          type="button"
          aria-label="Maximize or restore"
          onClick={() => window.electronAPI?.maximizeWindow()}
          className={CAPTION_BTN}
        >
          <Square size={11} strokeWidth={2.25} />
        </button>
        <button
          type="button"
          aria-label="Close"
          onClick={() => window.electronAPI?.closeWindow()}
          className={`${CAPTION_BTN} hover:!bg-[#c42b1c]`}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Notch (Dynamic Island) mini player                                        */
/* -------------------------------------------------------------------------- */

const RING_RADIUS = 16;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function NotchPlayer({
  trackName,
  artistName,
  imageSrc,
  isPlaying,
  onPrev,
  onToggle,
  onNext,
  onExpand,
}: {
  trackName: string;
  artistName: string;
  imageSrc: string | null;
  isPlaying: boolean;
  onPrev: () => void;
  onToggle: () => void;
  onNext: () => void;
  onExpand: () => void;
}) {
  // Bound straight to the playback store: the native player's events update it on
  // Android, the <audio> element's handlers on web/Electron. No DOM listeners here.
  const currentTime = usePlayback((s) => s.currentTime);
  const duration = usePlayback((s) => s.duration);
  const pct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const iconBtn =
    "flex h-7 w-7 items-center justify-center rounded-full text-white/65 transition-colors hover:bg-white/10 hover:text-white " +
    FOCUS_RING;

  return (
    <div className="flex h-full w-full items-start justify-center bg-transparent">
      <div
        role="region"
        aria-label="Mini player"
        className="relative mt-[5px] flex h-[55px] w-[380px] select-none items-center gap-2.5 overflow-hidden rounded-full border border-white/10 pl-2.5 pr-1.5 text-white"
        style={{
          ...DRAG,
          background: "linear-gradient(180deg, #1d1d20 0%, #0b0b0d 100%)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        {/* Artwork */}
        <div
          className={`h-9 w-9 shrink-0 overflow-hidden rounded-full ${isPlaying ? "motion-safe:animate-spin" : ""}`}
          style={{ animationDuration: "8s" }}
        >
          <SafeImage src={imageSrc} alt={trackName} className="h-9 w-9 rounded-full" iconSize={15} />
        </div>

        {/* Track info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-semibold leading-tight">{trackName}</p>
          <p className="truncate text-[10px] leading-tight text-white/50">{artistName}</p>
        </div>

        {/* Elapsed time */}
        <span className="shrink-0 text-[10px] font-medium tabular-nums text-white/45">
          {formatTime(currentTime)}
        </span>

        {/* Transport controls */}
        <div className="flex shrink-0 items-center gap-0.5" style={NO_DRAG}>
          <button type="button" aria-label="Previous track" onClick={onPrev} className={iconBtn}>
            <SkipBack size={14} className="fill-current" />
          </button>

          <button
            type="button"
            aria-label={isPlaying ? "Pause" : "Play"}
            onClick={onToggle}
            className={`relative h-9 w-9 shrink-0 rounded-full transition-transform hover:scale-105 ${FOCUS_RING}`}
          >
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
              <circle cx="18" cy="18" r={RING_RADIUS} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="2" />
              <circle
                cx="18"
                cy="18"
                r={RING_RADIUS}
                fill="none"
                stroke="var(--color-brand, #fff)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={RING_CIRCUMFERENCE * (1 - pct / 100)}
                style={{ transition: "stroke-dashoffset 0.3s linear" }}
              />
            </svg>
            <span className="absolute inset-[4px] flex items-center justify-center rounded-full bg-white text-black">
              {isPlaying ? (
                <Pause size={12} className="fill-current" />
              ) : (
                <Play size={12} className="ml-0.5 fill-current" />
              )}
            </span>
          </button>

          <button type="button" aria-label="Next track" onClick={onNext} className={iconBtn}>
            <SkipForward size={14} className="fill-current" />
          </button>
        </div>

        {/* Expand */}
        <div className="flex shrink-0 items-center border-l border-white/10 pl-1.5" style={NO_DRAG}>
          <button type="button" aria-label="Restore full window" onClick={onExpand} className={iconBtn}>
            <Maximize2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Route / error components                                                  */
/* -------------------------------------------------------------------------- */

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <p className="mt-4 text-sm text-muted-foreground">The page you're looking for doesn't exist.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-bold" style={{ backgroundColor: "var(--color-brand)", color: "#000" }}>
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">This page didn't load</h1>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-bold" style={{ backgroundColor: "var(--color-brand)", color: "#000" }}>
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" },
      { title: "AudiFiya – Feel Every Beat" },
      { name: "description", content: "AudiFiya — where melody meets the heart. Stream music instantly across languages, no account needed." },
      { name: "author", content: "AudiFiya" },
      { name: "application-name", content: "AudiFiya" },
      { property: "og:site_name", content: "AudiFiya" },
      { property: "og:title", content: "AudiFiya – Feel Every Beat" },
      { property: "og:description", content: "AudiFiya — where melody meets the heart. Stream music instantly across languages, no account needed." },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&family=Great+Vibes&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return <html lang="en"><head><HeadContent /></head><body>{children}<Scripts /></body></html>;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return <QueryClientProvider client={queryClient}><AppLayout /></QueryClientProvider>;
}

/* -------------------------------------------------------------------------- */
/*  App layout                                                                */
/* -------------------------------------------------------------------------- */

const NOTCH_STYLE_ID = "audifiya-notch-transparency";
const NOTCH_CSS = `
html.audifiya-notch,
html.audifiya-notch body,
html.audifiya-notch #root {
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
}
html.audifiya-notch body::before,
html.audifiya-notch body::after,
html.audifiya-notch #root::before,
html.audifiya-notch #root::after {
  background: none !important;
  background-image: none !important;
  display: none !important;
}
`;

function AppLayout() {
  const { profile, hydrated } = useProfile();
  const { liquid, light } = useThemeMode();
  // Selectors, not usePlayback(): the progress ticks several times a second and must
  // not re-render the whole layout.
  const currentTrack = usePlayback((s) => s.currentTrack);
  const isPlaying = usePlayback((s) => s.isPlaying);
  const togglePlay = usePlayback((s) => s.togglePlay);
  const next = usePlayback((s) => s.next);
  const prev = usePlayback((s) => s.prev);
  useMediaSession();

  // Native (Capacitor) only: keep the system status-bar icons readable against the UI.
  useEffect(() => {
    void setNativeStatusBarStyle(Boolean(light));
  }, [light]);

  const [isNotchMode, setIsNotchMode] = useState(false);
  const isDesktop = useIsDesktop(); // typeof window !== "undefined" && Boolean(window.electronAPI)

  const isAdminRoute = useRouterState({ select: (s) => s.location.pathname.startsWith("/audifiya-admin-panel") });
  const account = useAccount(isAdminRoute);

  const enterNotch = useCallback(() => {
    setIsNotchMode(true);
    window.electronAPI?.minimizeToNotch();
  }, []);

  const exitNotch = useCallback(() => {
    setIsNotchMode(false);
    window.electronAPI?.restoreWindow();
  }, []);

  // AGGRESSIVE TRANSPARENCY ENFORCER
  // Forces transparent backgrounds on <html>, <body> and #root (inline + injected
  // stylesheet, including pseudo-elements) to avoid Windows rendering artifacts.
  useEffect(() => {
    if (!isNotchMode) return;

    const html = document.documentElement;
    const body = document.body;
    const rootNode = document.getElementById("root");
    const targets = [html, body, rootNode].filter(Boolean) as HTMLElement[];

    for (const el of targets) {
      el.style.setProperty("background", "transparent", "important");
      el.style.setProperty("background-color", "transparent", "important");
      el.style.setProperty("background-image", "none", "important");
    }

    html.classList.add("audifiya-notch");
    const styleEl = document.createElement("style");
    styleEl.id = NOTCH_STYLE_ID;
    styleEl.textContent = NOTCH_CSS;
    document.head.appendChild(styleEl);

    return () => {
      for (const el of targets) {
        el.style.removeProperty("background");
        el.style.removeProperty("background-color");
        el.style.removeProperty("background-image");
      }
      html.classList.remove("audifiya-notch");
      styleEl.remove();
    };
  }, [isNotchMode]);

  // Validated once per track; never null-unsafe, never an empty string / array.
  const finalImgSrc = useMemo(() => safeThumbnail(currentTrack), [currentTrack]);
  const trackName = currentTrack?.name || "AudiFiya";
  const artistName = currentTrack?.artists?.primary?.[0]?.name || "Feel Every Beat";

  if (!isAdminRoute && account.banned) return <BannedScreen />;

  return (
    <div
      className="app-safe-area relative flex h-[100dvh] max-h-[100dvh] min-h-[100dvh] w-full flex-col overflow-hidden overflow-x-hidden"
      style={
        isNotchMode
          ? { background: "transparent", backgroundImage: "none" }
          : { backgroundColor: "var(--color-base)" }
      }
    >
      {/* 1. GLOBAL DESKTOP TITLE BAR */}
      {isDesktop && !isNotchMode && <DesktopTitleBar onNotch={enterNotch} />}

      {/* 2. DYNAMIC ISLAND NOTCH VIEW */}
      {isDesktop && isNotchMode && (
        <NotchPlayer
          trackName={trackName}
          artistName={artistName}
          imageSrc={finalImgSrc}
          isPlaying={isPlaying}
          onPrev={prev}
          onToggle={togglePlay}
          onNext={next}
          onExpand={exitNotch}
        />
      )}

      {/* 3. FULL APPLICATION VIEW (kept mounted while in notch mode to preserve state) */}
      <div className={`min-h-0 w-full flex-1 flex-col ${isNotchMode ? "hidden" : "flex"} ${isDesktop && !isNotchMode ? "pt-[38px]" : ""}`}>
        <div
          className={`flex min-h-0 w-full flex-1 overflow-hidden md:pb-[90px] ${
            // The bottom safe-area inset is already padded by the .app-safe-area wrapper.
            liquid ? "pb-[92px]" : "pb-[85px]"
          }`}
        >
          <Sidebar />
          <main className="flex min-h-0 w-full flex-1 overflow-hidden py-2 pr-2 pl-2 md:pl-0">
            <Outlet />
          </main>
        </div>

        <MobileTabBar />
        <MiniPlayer />
        <PlayerBar />
        <ExpandedPlayer />
        <ArtistOverlay />
        <FeedbackWidget />
        <Toaster position="top-center" offset="calc(var(--safe-top) + 24px)" />
        {!isAdminRoute && hydrated && !profile && <OnboardingModal />}
        {!isAdminRoute && hydrated && profile && account.ready && !account.profile && account.session && <UsernamePrompt />}
      </div>

      <audio id="nativeAudio" preload="metadata" />
      <audio id="prefetchAudio" preload="auto" muted />
    </div>
  );
}