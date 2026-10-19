import { useRouter } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { useProfile } from "@/lib/user-profile";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandMark } from "@/components/BrandMark";
import { usePlayback } from "@/lib/playback-engine";
import { useThemeMode } from "@/lib/theme-mode";

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { profile } = useProfile();
  const { currentTrack } = usePlayback();
  const { liquid } = useThemeMode();



  return (
    <div
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-lg"
      style={{ backgroundColor: "var(--color-surface-main)" }}
    >
      <header
        className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-t-lg px-4 py-3 backdrop-blur md:px-6"
        style={{ backgroundColor: "rgba(18,18,18,0.75)" }}
      >
        <div className="flex items-center gap-2">
          <div className="mr-1 md:hidden">
            <BrandMark size="sm" />
          </div>
          <button
            aria-label="Back"
            onClick={() => router.history.back()}
            className="grid h-8 w-8 place-items-center rounded-full"
            style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            aria-label="Forward"
            onClick={() => router.history.forward()}
            className="grid h-8 w-8 place-items-center rounded-full"
            style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {profile && (

          <div
            className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm"
            style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          >
            <div
              className="grid h-6 w-6 place-items-center rounded-full text-xs font-bold"
              style={{ backgroundColor: "var(--color-brand)", color: "#000" }}
            >
              {profile.username[0]?.toUpperCase()}
            </div>
            <span className="font-medium">{profile.username}</span>
          </div>
          )}
        </div>

      </header>
      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-6 md:px-6 md:pb-8">
        {children}
        {/* Spacer only while a track is loaded: clears the floating mini-player */}
        {currentTrack && (
          <div
            aria-hidden="true"
            className={`w-full shrink-0 ${liquid ? "h-[70px]" : "h-[40px]"}`}
          />
        )}
      </div>
    </div>
  );
}
