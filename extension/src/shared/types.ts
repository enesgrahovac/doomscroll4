export type FeedAction = "show" | "blur" | "hide";

export type GremlinState = "idle" | "hungry" | "eating" | "satisfied" | "angry";

export type Goal = "learn" | "stay_informed" | "network" | "all";

export interface UserProfilePayload {
  interests: string[];
  goal: Goal;
  avoids: string[];
  platform_intent: string;
}

export interface ClassifyRequest {
  post_text: string;
  platform: string;
  user_profile: UserProfilePayload;
}

export interface ClassifyResponse {
  action: FeedAction;
  score: number;
  confidence: number;
  reason: string;
  prompt_version: string;
}

export interface PlatformAdapter {
  name: string;
  isMatch(url: string): boolean;
  getPostSelector(): string;
  extractPostText(el: Element): string;
  getPostId(el: Element): string;
}
