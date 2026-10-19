import { useEffect, useState } from "react";

export interface PreferredArtist {
  id: string;
  name: string;
  image?: string;
}

export interface UserProfile {
  username: string;
  languages: string[];
  artists?: PreferredArtist[];
}

const KEY = "app_user_profile";

export function readProfile(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export function writeProfile(p: UserProfile) {
  window.localStorage.setItem(KEY, JSON.stringify(p));
  window.dispatchEvent(new CustomEvent("app-profile-changed"));
}

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setProfile(readProfile());
    setHydrated(true);
    const handler = () => setProfile(readProfile());
    window.addEventListener("app-profile-changed", handler);
    return () => window.removeEventListener("app-profile-changed", handler);
  }, []);
  return { profile, hydrated };
}
