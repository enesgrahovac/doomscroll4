import { PlatformAdapter, ClassifyResponse } from "../shared/types";
import { getProfile, getApiConfig, incrementStat } from "../shared/storage";
import { classifyPost } from "./classifier";
import { applyAction, applyPendingState, reapplyState } from "./ui";

const classifiedIds = new Set<string>();
const pendingRetries = new Set<string>();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let activeAdapter: PlatformAdapter | null = null;

// Cache results keyed by post ID so we can re-apply after DOM recycling
const resultCache = new Map<string, ClassifyResponse>();

const MAX_RETRIES = 5;
const RETRY_DELAY = 300; // ms
const retryCount = new Map<string, number>();

function scheduleRetry(post: Element, id: string): void {
  const count = (retryCount.get(id) ?? 0) + 1;
  retryCount.set(id, count);

  if (count > MAX_RETRIES) {
    // Give up — classify as blur with what we have
    pendingRetries.delete(id);
    classifiedIds.add(id);
    post.setAttribute("data-ds4-id", id);
    const fallback: ClassifyResponse = {
      action: "blur",
      score: 0.3,
      confidence: 0.3,
      reason: "Could not extract post text — blurred as fallback",
      prompt_version: "client",
    };
    resultCache.set(id, fallback);
    applyAction(post, "blur", fallback.reason);
    incrementStat("blur");
    return;
  }

  setTimeout(() => {
    if (!activeAdapter || classifiedIds.has(id)) return;

    const text = activeAdapter.extractPostText(post);
    if (text && text.trim().length > 0) {
      pendingRetries.delete(id);
      classifiedIds.add(id);
      post.setAttribute("data-ds4-id", id);
      classifyAndApply(post, id, text, activeAdapter.name);
    } else {
      // Check if media appeared since last check
      const hasMedia = post.querySelector(
        'video, [data-testid="videoPlayer"], [data-testid="tweetPhoto"], ' +
        '[data-testid="card.wrapper"], [data-testid="previewInterstitial"], ' +
        '[data-testid="playButton"]'
      );
      if (hasMedia) {
        pendingRetries.delete(id);
        classifiedIds.add(id);
        post.setAttribute("data-ds4-id", id);
        const mediaResult: ClassifyResponse = {
          action: "blur",
          score: 0.3,
          confidence: 0.5,
          reason: "Media-only post — no text to classify",
          prompt_version: "client",
        };
        resultCache.set(id, mediaResult);
        applyAction(post, "blur", mediaResult.reason);
        incrementStat("blur");
      } else {
        // Still nothing — retry again
        scheduleRetry(post, id);
      }
    }
  }, RETRY_DELAY * count);
}

function classifyAndApply(
  post: Element,
  id: string,
  text: string,
  adapterName: string
): void {
  // Apply pending blur immediately
  applyPendingState(post);

  const doClassify = async () => {
    const profile = await getProfile();
    const apiConfig = await getApiConfig();

    try {
      const result = await classifyPost(text, adapterName, profile, apiConfig);
      resultCache.set(id, result);

      const isFallback = result.prompt_version === "fallback";
      const retryFn = isFallback
        ? () => classifyAndApply(post, id, text, adapterName)
        : undefined;

      applyAction(post, result.action, result.reason, retryFn);
      incrementStat(result.action);
    } catch (err) {
      console.warn("[DS4] Failed to process post:", err);
      applyAction(post, "blur", "Classification failed", () =>
        classifyAndApply(post, id, text, adapterName)
      );
    }
  };

  doClassify();
}

function processNewPosts(): void {
  if (!activeAdapter) return;

  const posts = document.querySelectorAll(activeAdapter.getPostSelector());

  for (const post of posts) {
    // If this post already has a state (e.g. hidden posts whose innerHTML was cleared),
    // use the stored ID to avoid generating a new hash-based ID from destroyed content.
    const storedId = post.getAttribute("data-ds4-id");
    if (storedId && post.hasAttribute("data-ds4-state")) {
      // Already fully processed — just ensure visual state is intact
      reapplyState(post);
      continue;
    }

    const id = storedId || activeAdapter.getPostId(post);

    // Already classified — check if DOM state needs re-application
    if (classifiedIds.has(id)) {
      const cached = resultCache.get(id);
      if (cached) {
        // Re-apply if DOM was recycled (state data attribute gone or visual gone)
        if (!post.hasAttribute("data-ds4-state")) {
          applyAction(post, cached.action, cached.reason);
        } else {
          reapplyState(post);
        }
      }
      continue;
    }

    let text = activeAdapter.extractPostText(post);
    const hasMedia = post.querySelector(
      'video, [data-testid="videoPlayer"], [data-testid="tweetPhoto"], ' +
      '[data-testid="card.wrapper"], [data-testid="previewInterstitial"], ' +
      '[data-testid="playButton"]'
    );

    // No text at all — check for media
    if (!text || text.trim().length === 0) {
      if (hasMedia) {
        // Media-only post — blur by default
        classifiedIds.add(id);
        post.setAttribute("data-ds4-id", id);
        const mediaResult: ClassifyResponse = {
          action: "blur",
          score: 0.3,
          confidence: 0.5,
          reason: "Media-only post — no text to classify",
          prompt_version: "client",
        };
        resultCache.set(id, mediaResult);
        applyAction(post, "blur", mediaResult.reason);
        incrementStat("blur");
        continue;
      }

      // No text, no media — might still be rendering. Retry.
      if (!pendingRetries.has(id)) {
        pendingRetries.add(id);
        applyPendingState(post);
        scheduleRetry(post, id);
      }
      continue;
    }

    // Has text — classify it regardless of length (even short posts like "Tabs.")
    pendingRetries.delete(id);
    classifiedIds.add(id);
    post.setAttribute("data-ds4-id", id);
    classifyAndApply(post, id, text, activeAdapter.name);
  }
}

function scheduleProcessing(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    processNewPosts();
  }, 150);
}

export function init(adapter: PlatformAdapter): void {
  activeAdapter = adapter;
  console.log(`[DS4] Observer started for ${adapter.name}`);

  // Process existing posts immediately
  processNewPosts();

  // Also process after a short delay to catch any first-post race conditions
  setTimeout(() => processNewPosts(), 500);

  // Watch for new posts
  const observer = new MutationObserver(() => {
    scheduleProcessing();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}
