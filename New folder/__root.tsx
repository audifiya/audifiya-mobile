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
import { useEffect, useState, type ReactNode } from "react";

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
import { Play, Pause, Maximize2, SkipBack, SkipForward, X, Square, Minus } from "lucide-react";
import { getThumbnail } from "@/lib/jiosaavn";

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

function AppLayout() {
  const { profile, hydrated } = useProfile();
  const { liquid } = useThemeMode();
  const { currentTrack, isPlaying, togglePlay, next, prev } = usePlayback();
  useMediaSession();

  const [isNotchMode, setIsNotchMode] = useState(false);
  const [notchProgress, setNotchProgress] = useState(0);
  const [displayCurrent, setDisplayCurrent] = useState(0);
  const isDesktop = typeof window !== "undefined" && Boolean(window.electronAPI);

  const isAdminRoute = useRouterState({ select: (s) => s.location.pathname.startsWith("/audifiya-admin-panel") });
  const account = useAccount(isAdminRoute);

  // ULTRA-AGGRESSIVE TRANSPARENCY ENFORCER
  // Strips gradients, background images, and colors from all root containers
  useEffect(() => {
    const rootNode = document.getElementById("root");
    if (isNotchMode) {
      document.documentElement.style.setProperty("background", "transparent", "important");
      document.body.style.setProperty("background", "transparent", "important");
      if (rootNode) rootNode.style.setProperty("background", "transparent", "important");
    } else {
      document.documentElement.style.removeProperty("background");
      document.body.style.removeProperty("background");
      if (rootNode) rootNode.style.removeProperty("background");
    }
  }, [isNotchMode]);

  // Sync real-time progress for the Notch UI
  useEffect(() => {
    const el = document.getElementById("nativeAudio") as HTMLAudioElement;
    if (!el) return;
    const onTime = () => {
      if (el.duration && isFinite(el.duration)) {
        setNotchProgress((el.currentTime / el.duration) * 100);
      }
      setDisplayCurrent(Math.floor(el.currentTime));
    };
    el.addEventListener("timeupdate", onTime);
    return () => el.removeEventListener("timeupdate", onTime);
  }, []);

  const safeThumb = currentTrack ? getThumbnail(currentTrack) : null;
  const finalImgSrc = (typeof safeThumb === "string" && safeThumb.trim() !== "") ? safeThumb : null;
  const trackName = currentTrack?.name || "AudiFiya";
  const artistName = currentTrack?.artists?.primary?.[0]?.name || "Feel Every Beat";

  if (!isAdminRoute && account.banned) return <BannedScreen />;

  return (
    <div
      className="relative flex h-[100dvh] max-h-[100dvh] min-h-[100dvh] w-full flex-col overflow-hidden overflow-x-hidden"
      style={isNotchMode ? { background: "transparent" } : { backgroundColor: "var(--color-base)" }}
    >
      {/* 1. GLOBAL DESKTOP TITLE BAR */}
      {isDesktop && !isNotchMode && (
        <div
          className="absolute top-0 left-0 right-0 h-[38px] flex items-center justify-between px-3 bg-black/50 backdrop-blur-md border-b border-white/5 z-[9999] pointer-events-none select-none"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        >
          <span className="text-[11px] font-medium tracking-wide text-white/50 pl-2">AudiFiya</span>
          
          <div className="flex items-center gap-1.5 pointer-events-auto" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
            <button
              onClick={() => { setIsNotchMode(true); window.electronAPI?.minimizeToNotch(); }}
              className="px-2.5 py-1 flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-black bg-white hover:bg-neutral-200 rounded-full transition-colors mr-3"
            >
              Notch
            </button>
            
            <button onClick={() => window.electronAPI?.minimizeWindow()} className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors"><Minus size={15} /></button>
            <button onClick={() => window.electronAPI?.maximizeWindow()} className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors"><Square size={12} strokeWidth={2.5} /></button>
            <button onClick={() => window.electronAPI?.closeWindow()} className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-500 hover:text-white text-white/70 transition-colors"><X size={15} /></button>
          </div>
        </div>
      )}

      {/* 2. DYNAMIC ISLAND NOTCH VIEW */}
      <div className={`w-full h-full bg-transparent flex items-start justify-center ${isNotchMode ? "flex" : "hidden"}`}>
        <div
          className="relative w-[380px] h-[55px] bg-black border border-white/15 shadow-2xl rounded-full flex items-center justify-between px-3 mt-1 overflow-hidden"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        >
          {/* Left: Track Info */}
          <div className="flex items-center gap-3 overflow-hidden flex-1 pl-1">
            {finalImgSrc ? (
              <img src={finalImgSrc} alt={trackName} className={`w-8 h-8 rounded-full object-cover shrink-0 ${isPlaying ? "animate-spin" : ""}`} style={{ animationDuration: "8s" }} />
            ) : (
              <div className="w-8 h-8 rounded-full bg-neutral-800 animate-pulse shrink-0" />
            )}
            <div className="flex flex-col min-w-0 flex-1 pr-2">
              <span className="text-white text-[12px] font-semibold truncate leading-tight">{trackName}</span>
              <span className="text-neutral-400 text-[9px] truncate leading-tight">{artistName}</span>
            </div>
          </div>

          {/* Middle: Controls */}
          <div className="flex items-center gap-2 shrink-0 px-2" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
            <span className="text-[10px] text-neutral-400 tabular-nums font-medium mr-1">{formatTime(displayCurrent)}</span>
            
            <button onClick={prev} className="text-white/70 hover:text-white transition-colors p-1"><SkipBack size={14} className="fill-current" /></button>
            <button onClick={togglePlay} className="w-7 h-7 flex items-center justify-center bg-white text-black rounded-full hover:scale-105 transition-transform shadow-lg">
              {isPlaying ? <Pause size={13} className="fill-current" /> : <Play size={13} className="fill-current ml-0.5" />}
            </button>
            <button onClick={next} className="text-white/70 hover:text-white transition-colors p-1"><SkipForward size={14} className="fill-current" /></button>
          </div>

          {/* Right: Expand Back */}
          <div className="flex items-center shrink-0 border-l border-white/15 pl-2 ml-1" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
             <button
              onClick={() => { setIsNotchMode(false); window.electronAPI?.restoreWindow(); }}
              className="p-1.5 text-white/50 hover:text-white transition-colors"
            >
              <Maximize2 size={14} />
            </button>
          </div>

          {/* Progress Bar inside the Notch */}
          <div className="absolute bottom-0 left-6 right-6 h-[2px] bg-white/10 rounded-full overflow-hidden">
             <div className="h-full bg-white transition-all duration-300 ease-linear" style={{ width: `${notchProgress}%` }} />
          </div>
        </div>
      </div>

      {/* 3. FULL APPLICATION VIEW */}
      <div className={`flex-1 flex-col w-full min-h-0 ${isNotchMode ? "hidden" : "flex"} ${isDesktop && !isNotchMode ? "pt-[38px]" : ""}`}>
        <div
          className={`flex min-h-0 w-full flex-1 overflow-hidden md:pb-[90px] ${
            liquid ? "pb-[calc(92px+env(safe-area-inset-bottom))]" : "pb-[calc(85px+env(safe-area-inset-bottom))]"
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
        <Toaster position="top-center" />
        {!isAdminRoute && hydrated && !profile && <OnboardingModal />}
        {!isAdminRoute && hydrated && profile && account.ready && !account.profile && account.session && <UsernamePrompt />}
      </div>

      <audio id="nativeAudio" preload="metadata" />
      <audio id="prefetchAudio" preload="auto" muted />
    </div>
  );
}