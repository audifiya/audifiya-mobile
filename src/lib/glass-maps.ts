// Client-only canvas generators for SVG glass refraction maps.
const cache = new Map<string, { displacement: string; specular: string }>();

export function supportsSvgBackdrop(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } };
  const brands = nav.userAgentData?.brands?.map((b) => b.brand) ?? [];
  return brands.some((b) => /Chromium|Google Chrome/.test(b));
}

export function buildGlassMaps(w: number, h: number, radius = h / 2, bezel = 14) {
  w = Math.max(8, Math.round(w));
  h = Math.max(8, Math.round(h));
  const key = `${w}x${h}x${Math.round(radius)}x${Math.round(bezel)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const mk = () => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  };
  const dCanvas = mk();
  const sCanvas = mk();
  const dCtx = dCanvas.getContext("2d")!;
  const sCtx = sCanvas.getContext("2d")!;
  const d = dCtx.createImageData(w, h);
  const s = sCtx.createImageData(w, h);
  const r = Math.min(radius, w / 2, h / 2);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // signed distance to rounded rect (negative inside)
      const px = x + 0.5 - w / 2;
      const py = y + 0.5 - h / 2;
      const qx = Math.abs(px) - (w / 2 - r);
      const qy = Math.abs(py) - (h / 2 - r);
      const ox = Math.max(qx, 0);
      const oy = Math.max(qy, 0);
      const dist = Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
      const inset = -dist; // distance from edge, inward
      const i = (y * w + x) * 4;

      let nx = 0;
      let ny = 0;
      let strength = 0;
      if (inset > 0 && inset < bezel) {
        // convex squircle slope: strongest at the rim, flat in the middle
        const t = 1 - inset / bezel;
        strength = Math.pow(t, 2.2);
        const len = Math.hypot(ox || (qx > qy ? 1 : 0), oy || (qy >= qx ? 1 : 0)) || 1;
        nx = ((ox || (qx > qy ? 1 : 0)) / len) * Math.sign(px);
        ny = ((oy || (qy >= qx ? 1 : 0)) / len) * Math.sign(py);
      }
      // pull pixels inward (magnify) near the rim
      d.data[i] = 128 - nx * strength * 127;
      d.data[i + 1] = 128 - ny * strength * 127;
      d.data[i + 2] = 128;
      d.data[i + 3] = 255;

      // specular: light from top-left, only along the rim
      const light = Math.max(0, -ny * 0.85 - nx * 0.35);
      const spec = inset > 0 ? Math.pow(strength, 1.5) * light * 255 : 0;
      s.data[i] = spec;
      s.data[i + 1] = spec;
      s.data[i + 2] = spec;
      s.data[i + 3] = 255;
    }
  }
  dCtx.putImageData(d, 0, 0);
  sCtx.putImageData(s, 0, 0);
  const out = { displacement: dCanvas.toDataURL(), specular: sCanvas.toDataURL() };
  cache.set(key, out);
  return out;
}
