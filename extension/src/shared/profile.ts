import { Goal } from "./types";

export interface PlatformProfile {
  intent: string;
  enabled: boolean;
}

export interface UserProfile {
  interests: string[];
  goal: Goal;
  avoids: string[];
  platforms: {
    twitter: PlatformProfile;
    linkedin: PlatformProfile;
    instagram: PlatformProfile;
  };
  onboardingComplete: boolean;
  createdAt: number;
}

export const DEFAULT_PROFILE: UserProfile = {
  interests: [],
  goal: "learn",
  avoids: [],
  platforms: {
    twitter: { intent: "", enabled: true },
    linkedin: { intent: "", enabled: false },
    instagram: { intent: "", enabled: false },
  },
  onboardingComplete: false,
  createdAt: Date.now(),
};

export function validateProfile(p: unknown): UserProfile {
  if (!p || typeof p !== "object") return { ...DEFAULT_PROFILE, createdAt: Date.now() };

  const obj = p as Record<string, unknown>;

  if (!Array.isArray(obj.interests)) return { ...DEFAULT_PROFILE, createdAt: Date.now() };
  if (!Array.isArray(obj.avoids)) return { ...DEFAULT_PROFILE, createdAt: Date.now() };
  if (!["learn", "stay_informed", "network", "all"].includes(obj.goal as string)) {
    return { ...DEFAULT_PROFILE, createdAt: Date.now() };
  }
  if (typeof obj.platforms !== "object" || !obj.platforms) {
    return { ...DEFAULT_PROFILE, createdAt: Date.now() };
  }
  if (typeof obj.onboardingComplete !== "boolean") {
    return { ...DEFAULT_PROFILE, createdAt: Date.now() };
  }

  return obj as unknown as UserProfile;
}
