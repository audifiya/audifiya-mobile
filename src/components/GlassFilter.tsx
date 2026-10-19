import { useEffect, useState, type RefObject } from "react";
import { buildGlassMaps, supportsSvgBackdrop } from "@/lib/glass-maps";

/**
 * Measures `target`, builds refraction maps for its size, and renders an SVG
 * filter. Returns the backdrop-filter value to apply (null = unsupported).
 */
export function useGlassRefraction(
  id: string,
  target: RefObject<HTMLElement | null>,
  opts: { radius?: number; bezel?: number; blur?: number; saturate?: number } = {},
) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [maps, setMaps] = useState<{ displacement: string; specular: string } | null>(null);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(supportsSvgBackdrop());
    const el = target.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize((prev) =>
        prev && Math.round(prev.w) === Math.round(r.width) && Math.round(prev.h) === Math.round(r.height)
          ? prev
          : { w: r.width, h: r.height },
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, target.current]);

  useEffect(() => {
    if (!supported || !size || size.w < 8) return;
    setMaps(buildGlassMaps(size.w, size.h, opts.radius ?? size.h / 2, opts.bezel ?? 14));
  }, [supported, size, opts.radius, opts.bezel]);

  const svg =
    supported && maps && size ? (
      <svg aria-hidden="true" style={{ width: 0, height: 0, position: "absolute" }}>
        <defs>
          <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.8" result="blurred" />
            <feImage href={maps.displacement} x="0" y="0" width={size.w} height={size.h} result="displacement_map" preserveAspectRatio="none" />
            <feDisplacementMap in="blurred" in2="displacement_map" scale="34" xChannelSelector="R" yChannelSelector="G" result="displaced" />
            <feColorMatrix in="displaced" type="saturate" values="1.22" result="displaced_saturated" />
            <feImage href={maps.specular} x="0" y="0" width={size.w} height={size.h} result="specular_layer" preserveAspectRatio="none" />
            <feComponentTransfer in="specular_layer" result="specular_faded">
              <feFuncA type="linear" slope="0.8" />
            </feComponentTransfer>
            <feBlend in="specular_faded" in2="displaced_saturated" mode="screen" />
          </filter>
        </defs>
      </svg>
    ) : null;

  const backdrop =
    supported && maps
      ? `url(#${id}) blur(${opts.blur ?? 2}px) saturate(${opts.saturate ?? 160}%)`
      : null;

  return { svg, backdrop };
}
