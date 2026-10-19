import { useEffect, useState } from "react";
import { Download, Puzzle } from "lucide-react";
import { isExtension } from "@/lib/extension-env";

export function ExtensionCard() {
  const [inExt, setInExt] = useState(true);
  useEffect(() => setInExt(isExtension()), []);
  if (inExt) return null;

  const download = () => {
    fetch("/audifiya-extension.zip")
      .then((r) => {
        if (!r.ok) throw new Error(`Download failed: ${r.status}`);
        return r.blob();
      })
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "audifiya-extension.zip";
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch((e) => alert(e.message));
  };

  return (
    <section
      className="mx-4 mt-6 mb-4 rounded-xl p-4"
      style={{ backgroundColor: "var(--color-elevated, rgba(255,255,255,0.06))" }}
    >
      <div className="flex items-center gap-2 font-bold">
        <Puzzle size={18} /> AudiFiya for Chrome
      </div>
      <p className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>
        Keep AudiFiya open in Chrome's side panel. Music keeps playing even when you close it.
      </p>
      <button
        onClick={download}
        className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold"
        style={{ backgroundColor: "var(--color-brand)", color: "#000" }}
      >
        <Download size={16} /> Download extension
      </button>
      <ol className="mt-3 list-decimal pl-5 text-xs" style={{ color: "var(--color-text-secondary)" }}>
        <li>Unzip the downloaded file.</li>
        <li>Open chrome://extensions in Chrome, Edge or Brave.</li>
        <li>Turn on Developer mode (top right).</li>
        <li>Click "Load unpacked" and pick the unzipped folder.</li>
        <li>Click the AudiFiya icon in the toolbar to open the side panel.</li>
      </ol>
    </section>
  );
}
