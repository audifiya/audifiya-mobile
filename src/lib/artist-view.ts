import { create } from "zustand";

interface ArtistViewState {
  artistId: string | null;
  artistName: string | null;
  open: boolean;
  openArtist: (id: string, name: string) => void;
  close: () => void;
}

export const useArtistView = create<ArtistViewState>((set) => ({
  artistId: null,
  artistName: null,
  open: false,
  openArtist: (id, name) => {
    if (typeof window !== "undefined") {
      try {
        window.history.pushState({ artistOverlay: true }, "");
      } catch { /* noop */ }
    }
    set({ artistId: id, artistName: name, open: true });
  },
  close: () => set({ open: false }),
}));
