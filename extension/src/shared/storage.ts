import { FeedAction } from "./types";
import { UserProfile, DEFAULT_PROFILE, validateProfile } from "./profile";

const KEYS = {
  profile: "ds4_profile",
  apiConfig: "ds4_api_config",
  stats: "ds4_stats",
  statsDate: "ds4_stats_date",
} as const;

export async function getProfile(): Promise<UserProfile> {
  const result = await chrome.storage.sync.get(KEYS.profile);
  return validateProfile(result[KEYS.profile]);
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await chrome.storage.sync.set({ [KEYS.profile]: profile });
}

export interface ApiConfig {
  apiUrl: string;
  apiKey: string;
}

export async function getApiConfig(): Promise<ApiConfig> {
  const result = await chrome.storage.sync.get(KEYS.apiConfig);
  return (
    (result[KEYS.apiConfig] as ApiConfig) ?? {
      apiUrl: "https://doomscroll4-production.up.railway.app",
      apiKey: "",
    }
  );
}

export async function saveApiConfig(config: ApiConfig): Promise<void> {
  await chrome.storage.sync.set({ [KEYS.apiConfig]: config });
}

export interface Stats {
  shown: number;
  blurred: number;
  hidden: number;
}

export async function getStats(): Promise<Stats> {
  const result = await chrome.storage.sync.get([KEYS.stats, KEYS.statsDate]);
  const today = new Date().toDateString();

  if (result[KEYS.statsDate] !== today) {
    const fresh: Stats = { shown: 0, blurred: 0, hidden: 0 };
    await chrome.storage.sync.set({
      [KEYS.stats]: fresh,
      [KEYS.statsDate]: today,
    });
    return fresh;
  }

  return (result[KEYS.stats] as Stats) ?? { shown: 0, blurred: 0, hidden: 0 };
}

export async function incrementStat(action: FeedAction): Promise<void> {
  const stats = await getStats();
  if (action === "show") stats.shown++;
  else if (action === "blur") stats.blurred++;
  else if (action === "hide") stats.hidden++;
  await chrome.storage.sync.set({ [KEYS.stats]: stats });
}

export async function resetDailyStats(): Promise<void> {
  const fresh: Stats = { shown: 0, blurred: 0, hidden: 0 };
  await chrome.storage.sync.set({
    [KEYS.stats]: fresh,
    [KEYS.statsDate]: new Date().toDateString(),
  });
}
