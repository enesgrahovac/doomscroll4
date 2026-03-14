import { PlatformAdapter } from "../../shared/types";

function hashContent(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return "tw_" + Math.abs(hash).toString(36);
}

export const twitterAdapter: PlatformAdapter = {
  name: "twitter",

  isMatch(url: string): boolean {
    return url.includes("twitter.com") || url.includes("x.com");
  },

  getPostSelector(): string {
    return 'article[data-testid="tweet"]';
  },

  extractPostText(el: Element): string {
    const parts: string[] = [];

    // Detect retweet context (e.g. "UserName retweeted")
    const socialContext = el.querySelector('[data-testid="socialContext"]');
    if (socialContext?.textContent) {
      parts.push(`[${socialContext.textContent.trim()}]`);
    }

    // Get all tweetText nodes — a quote tweet nests a second one inside
    const textEls = el.querySelectorAll('[data-testid="tweetText"]');
    if (textEls.length === 0) return "";

    if (textEls.length === 1) {
      parts.push(textEls[0].textContent?.trim() ?? "");
    } else {
      // First is the outer tweet, rest are quoted content
      parts.push(textEls[0].textContent?.trim() ?? "");
      for (let i = 1; i < textEls.length; i++) {
        const quoted = textEls[i].textContent?.trim();
        if (quoted) {
          parts.push(`[quoted post] ${quoted}`);
        }
      }
    }

    return parts.filter(Boolean).join("\n");
  },

  getPostId(el: Element): string {
    const link = el.querySelector('a[href*="/status/"]');
    if (link) {
      const href = link.getAttribute("href") ?? "";
      const match = href.match(/\/status\/(\d+)/);
      if (match) return match[1];
    }
    // Fallback: hash the content
    const text = this.extractPostText(el);
    return hashContent(text || el.textContent || "unknown");
  },
};
