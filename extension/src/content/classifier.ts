import { ClassifyResponse } from "../shared/types";
import { UserProfile } from "../shared/profile";
import { ApiConfig } from "../shared/storage";

const cache = new Map<string, ClassifyResponse>();

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36);
}

const FALLBACK_RESPONSE: ClassifyResponse = {
  action: "blur",
  score: 0.5,
  confidence: 0,
  reason: "Classification unavailable — blurred as a safe fallback",
  prompt_version: "fallback",
};

export async function classifyPost(
  text: string,
  platform: string,
  profile: UserProfile,
  apiConfig: ApiConfig
): Promise<ClassifyResponse> {
  const key = simpleHash(text);

  const cached = cache.get(key);
  if (cached) return cached;

  const platformProfile = profile.platforms[platform as keyof typeof profile.platforms];

  const body = {
    post_text: text,
    platform,
    user_profile: {
      interests: profile.interests,
      goal: profile.goal,
      avoids: profile.avoids,
      platform_intent: platformProfile?.intent ?? "",
    },
  };

  try {
    // Route through background service worker (content scripts can't fetch cross-origin)
    const data: ClassifyResponse = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: "ds4_classify",
          apiUrl: apiConfig.apiUrl,
          apiKey: apiConfig.apiKey,
          body,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response?.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        }
      );
    });

    cache.set(key, data);
    return data;
  } catch (err) {
    console.warn("[DS4] Classify request failed:", err);
    return FALLBACK_RESPONSE;
  }
}
