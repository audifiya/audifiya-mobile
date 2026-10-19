// Minimal Web Speech API wrapper with graceful fallback.

type SR = any;

function getCtor(): SR | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isSpeechSupported(): boolean {
  return !!getCtor();
}

export interface Recognizer {
  start: () => void;
  stop: () => void;
}

export function createRecognizer(opts: {
  onResult: (transcript: string) => void;
  onEnd?: () => void;
  onError?: (err: string) => void;
}): Recognizer | null {
  const Ctor = getCtor();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.continuous = false;
  rec.interimResults = false;
  rec.lang = "en-US";
  rec.onresult = (e: any) => {
    const t = e.results?.[0]?.[0]?.transcript ?? "";
    if (t) opts.onResult(String(t).trim());
  };
  rec.onerror = (e: any) => opts.onError?.(e?.error ?? "error");
  rec.onend = () => opts.onEnd?.();
  return {
    start: () => {
      try { rec.start(); } catch { /* already started */ }
    },
    stop: () => {
      try { rec.stop(); } catch { /* noop */ }
    },
  };
}

export interface VoiceCommand {
  kind: "pause" | "play" | "search" | "query";
  query?: string;
}

export function parseVoiceCommand(raw: string): VoiceCommand {
  const t = raw.toLowerCase().trim().replace(/[.!?]+$/g, "");
  if (t === "stop" || t === "pause" || t === "ruko" || t === "rukho") {
    return { kind: "pause" };
  }
  if (t === "play" || t === "resume" || t === "chalao") {
    return { kind: "play" };
  }
  const searchFor = t.match(/^(?:search for|search|find)\s+(.+)$/);
  if (searchFor) return { kind: "search", query: searchFor[1] };
  const playFor = t.match(/^play\s+(.+)$/);
  if (playFor) return { kind: "search", query: playFor[1] };
  return { kind: "query", query: raw.trim() };
}
