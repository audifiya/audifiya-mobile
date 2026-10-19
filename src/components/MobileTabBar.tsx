import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Home, Search, Library } from "lucide-react";
import { motion, useMotionValue, animate, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useThemeMode } from "@/lib/theme-mode";
import { useGlassRefraction } from "@/components/GlassFilter";

const TABS = [
  { to: "/", label: "Home", Icon: Home },
  { to: "/search", label: "Search", Icon: Search },
  { to: "/library", label: "Library", Icon: Library },
] as const;

const SPRING = { type: "spring" as const, stiffness: 500, damping: 24 };

/** Exponential resistance once dragged past [min, max]. */
export function resist(x: number, min: number, max: number, k = 40) {
  if (x < min) return min - k * (1 - Math.exp((x - min) / k));
  if (x > max) return max + k * (1 - Math.exp((max - x) / k));
  return x;
}

export function MobileTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { liquid } = useThemeMode();
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const activeIndex =
    pathname === "/"
      ? 0
      : pathname === "/search"
        ? 1
        : pathname === "/library" || pathname.startsWith("/playlist")
          ? 2
          : -1;

  const navRef = useRef<HTMLElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const [tabW, setTabW] = useState(0);
  const x = useMotionValue(0);
  const scale = useMotionValue(1);
  const drag = useRef<{ startX: number; startLens: number; moved: boolean; id: number } | null>(null);
  const suppressClick = useRef(false);
  const { svg, backdrop } = useGlassRefraction("dockGlassFilter", lensRef, {
    radius: 26,
    bezel: 20,
    blur: 3,
    saturate: 180,
  });

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTabW((el.clientWidth - 16) / 3));
    ro.observe(el);
    return () => ro.disconnect();
  }, [liquid]);

  useEffect(() => {
    if (drag.current || !tabW) return;
    const target = Math.max(activeIndex, 0) * tabW;
    if (reduce) x.set(target);
    else animate(x, target, SPRING);
  }, [activeIndex, tabW, reduce, x]);

  if (!liquid) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-[calc(65px+var(--safe-bottom))] items-center justify-around rounded-none border-t border-white/10 bg-[#121212] px-2 pb-safe md:hidden">
        {TABS.map(({ to, label, Icon }, i) => (
          <Link
            key={to}
            to={to}
            className={`flex h-[54px] w-[75px] flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
              i === activeIndex ? "text-emerald-400" : "text-gray-400"
            }`}
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    );
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (activeIndex < 0 || !tabW || !navRef.current) return;
    const rect = navRef.current.getBoundingClientRect();
    const local = e.clientX - rect.left - 8;
    if (Math.floor(local / tabW) !== activeIndex) return; // only grab the lens
    drag.current = { startX: e.clientX, startLens: x.get(), moved: false, id: e.pointerId };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) > 6) {
      d.moved = true;
      navRef.current?.setPointerCapture(e.pointerId);
      animate(scale, 1.25, SPRING);
    }
    if (d.moved) x.set(resist(d.startLens + dx, 0, 2 * tabW));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.moved) return;
    suppressClick.current = true;
    navRef.current?.releasePointerCapture?.(e.pointerId);
    const idx = Math.min(2, Math.max(0, Math.round(x.get() / tabW)));
    animate(scale, 1, SPRING);
    animate(x, idx * tabW, reduce ? { duration: 0 } : SPRING);
    if (idx !== activeIndex) navigate({ to: TABS[idx].to });
  };

  return (
    <nav
      ref={navRef}
      aria-label="Primary navigation"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={(e) => {
        if (suppressClick.current) {
          suppressClick.current = false;
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      className="glass-dock fixed bottom-[calc(20px+var(--safe-bottom))] left-1/2 z-50 flex h-16 w-[92%] max-w-[390px] -translate-x-1/2 touch-pan-y items-center overflow-hidden rounded-full px-2 select-none md:hidden"
    >
      {svg}
      <motion.div
        ref={lensRef}
        aria-hidden="true"
        className="glass-refractive-lens absolute top-1.5 bottom-1.5 left-2 rounded-full will-change-transform"
        style={{
          width: "calc((100% - 16px) / 3)",
          x,
          scale,
          backdropFilter: backdrop ?? undefined,
        }}
        animate={{ opacity: activeIndex < 0 ? 0 : 1 }}
        transition={{ duration: 0.2 }}
      />
      {TABS.map(({ to, label, Icon }, i) => {
        const active = i === activeIndex;
        return (
          <Link
            key={to}
            to={to}
            draggable={false}
            aria-current={active ? "page" : undefined}
            className={`relative z-10 flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 transition-colors duration-200 motion-reduce:transition-none ${
              active ? "text-foreground" : "text-text-secondary hover:text-foreground"
            }`}
          >
            <Icon className={`h-6 w-6 ${active && label === "Home" ? "fill-current" : ""}`} />
            <span className="text-[10px] font-bold">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}