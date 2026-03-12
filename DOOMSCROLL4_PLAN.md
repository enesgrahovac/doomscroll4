# DOOMSCROLL4 — Technical Implementation Plan

> **Stack:** Chrome Extension (TypeScript/MV3) + FastAPI backend + Railway → Fly.io migration path

---

## Infrastructure Philosophy

| Phase | Platform | Why |
|---|---|---|
| MVP → ~1k users | Railway | Zero config, instant deploys, cheap, great DX |
| ~1k+ users / global | Fly.io | Regional deployment, no cold starts, persistent VMs, better for latency-sensitive AI calls |

Railway gives you a working prod environment in under an hour. Fly.io gives you the infra you'd want at scale. Don't migrate until you feel the pain — that's the signal.

---

## Repository Structure

```
doomscroll4/
├── extension/                  # Chrome Extension (TypeScript)
│   ├── manifest.json
│   ├── src/
│   │   ├── background/
│   │   │   └── service-worker.ts     # API key mgmt, auth, rate limit awareness
│   │   ├── content/
│   │   │   ├── index.ts              # Entry point, platform detection
│   │   │   ├── observer.ts           # MutationObserver, post detection
│   │   │   ├── classifier.ts         # Calls backend API, caches results
│   │   │   ├── ui.ts                 # Blur/hide/show DOM manipulation
│   │   │   └── platforms/
│   │   │       ├── twitter.ts        # Twitter-specific selectors + post extraction
│   │   │       ├── linkedin.ts
│   │   │       └── instagram.ts
│   │   ├── popup/
│   │   │   ├── popup.html
│   │   │   ├── popup.ts              # Interest profile UI + settings
│   │   │   └── popup.css
│   │   └── shared/
│   │       ├── types.ts              # Shared types across extension
│   │       ├── storage.ts            # chrome.storage wrappers
│   │       └── profile.ts            # UserProfile type, defaults, validation
│   ├── package.json
│   ├── tsconfig.json
│   └── webpack.config.js
│
├── api/                        # FastAPI Backend
│   ├── main.py                 # App entry point, route registration
│   ├── routers/
│   │   ├── classify.py         # POST /classify — core endpoint
│   │   ├── feedback.py         # POST /feedback — thumbs up/down
│   │   └── auth.py             # POST /auth/register, GET /auth/me
│   ├── services/
│   │   ├── classifier.py       # Anthropic API calls + prompt logic
│   │   ├── rate_limiter.py     # Redis-backed per-user rate limiting
│   │   └── prompt.py           # Prompt templates + versioning
│   ├── models/
│   │   ├── schemas.py          # Pydantic request/response models
│   │   └── db.py               # SQLite (dev) / Postgres (prod) models
│   ├── tests/
│   │   ├── test_classifier.py
│   │   └── fixtures/           # Real post samples for prompt testing
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
│
├── prompts/                    # Prompt versioning (your core IP)
│   ├── v1_classify.txt
│   └── CHANGELOG.md            # Track what changed and why
│
├── scripts/
│   ├── test_classify.py        # Local prompt harness (run before touching extension)
│   └── seed_fixtures.py        # Scrape sample posts for testing
│
└── DOOMSCROLL4.md              # This foundation doc
```

---

## Build Order

### Step 1 — Prompt Harness (No extension, no API yet)
*Goal: nail classification quality before writing any other code*

```bash
# scripts/test_classify.py
# Feed it a CSV of real posts, print score/action/reason for each
# Iterate on prompts/ until you're happy with accuracy
python scripts/test_classify.py --prompt prompts/v1_classify.txt --fixtures tests/fixtures/twitter.csv
```

Don't move to Step 2 until this feels good. Everything downstream depends on this.

---

### Step 2 — FastAPI Backend on Railway

#### Core endpoint first:

```
POST /classify
Body: {
  post_text,
  platform,
  user_profile: {
    interests,        # ["AI research", "Python", "startups"]
    goal,             # "learn" | "stay_informed" | "network" | "all"
    avoids,           # ["politics", "sports", "celebrity"]
    platform_intent   # free text: "stay current in my field"
  }
}
Returns: { action, score, confidence, reason, prompt_version }
```

#### Railway setup:
```bash
# In api/ directory
railway login
railway init
railway add redis          # For rate limiting
railway up

# Set env vars in Railway dashboard:
# ANTHROPIC_API_KEY=...
# REDIS_URL=...  (auto-injected by Railway)
# API_SECRET=...  (your own key to auth extension→API calls)
```

#### Dockerfile:
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

#### Rate limiting logic:
```python
# Free tier:  50 calls/day per user
# Pro tier:   unlimited
# Enforced server-side in Redis — never trust the client
```

---

### Step 3 — Chrome Extension

#### manifest.json (MV3):
```json
{
  "manifest_version": 3,
  "name": "Doomscroll4",
  "version": "0.1.0",
  "permissions": ["storage", "activeTab"],
  "host_permissions": [
    "https://twitter.com/*",
    "https://x.com/*",
    "https://www.linkedin.com/*",
    "https://www.instagram.com/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["https://twitter.com/*", "https://x.com/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup.html"
  }
}
```

#### Platform adapter pattern:
```typescript
// Each platform implements the same interface
interface PlatformAdapter {
  name: string;
  isMatch: (url: string) => boolean;
  getPostSelector: () => string;
  extractPostText: (el: Element) => string;
  getPostId: (el: Element) => string;
}

// observer.ts uses whichever adapter matches current URL
// This is what lets you add Instagram without touching core logic
```

#### MutationObserver strategy:
```typescript
// Watch for new posts added to feed container
// Debounce to avoid firing on every character of a typing indicator
// Cache post IDs already classified — never re-classify the same post
const observer = new MutationObserver(debounce(handleMutations, 150));
observer.observe(feedContainer, { childList: true, subtree: true });
```

#### UI states:
```typescript
// Applied as CSS classes injected via content script
// ds4-show  → no change
// ds4-blur  → CSS blur filter + overlay with summary + "Show me" button
// ds4-hide  → height: 32px, collapsed with "1 hidden post" label
```

---

### User Profile — Onboarding & Storage

The user profile is the core input to every classification. It lives in `chrome.storage.sync` so it follows the user across devices and is accessible to both the popup and content scripts.

#### UserProfile type (`shared/profile.ts`):
```typescript
export type Goal = "learn" | "stay_informed" | "network" | "all";

export interface PlatformProfile {
  intent: string;          // "stay current in my field"
  enabled: boolean;
}

export interface UserProfile {
  interests: string[];     // ["AI research", "Python", "startups"]
  goal: Goal;
  avoids: string[];        // ["politics", "sports", "celebrity drama"]
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
    twitter:   { intent: "", enabled: true },
    linkedin:  { intent: "", enabled: false },
    instagram: { intent: "", enabled: false },
  },
  onboardingComplete: false,
  createdAt: Date.now(),
};
```

#### First-run onboarding flow (`popup.ts`):

The popup detects `onboardingComplete: false` on first install and renders a 4-screen wizard instead of the settings panel. Takes ~60 seconds to complete.

```
Screen 1 — Interests
  Prompt: "What do you actually want to learn about?"
  Input:  Free text + quick-add chips (AI, investing, climate, design, startups...)
  Saves:  profile.interests[]

Screen 2 — Goal
  Prompt: "Why are you on social media?"
  Input:  Single select
          → Learn new things
          → Stay informed / news
          → Network & career
          → All of the above
  Saves:  profile.goal

Screen 3 — Avoids
  Prompt: "What should we filter out?"
  Input:  Free text + quick-add chips (Politics, Sports, Celebrity, Ads, Outrage bait...)
  Saves:  profile.avoids[]

Screen 4 — Platforms
  Prompt: "Where do you want Doomscroll4 active?"
  Input:  Toggle per platform + optional intent field per platform
          e.g. Twitter → "stay current on AI"
               LinkedIn → "find engineering leads"
  Saves:  profile.platforms{}
```

After Screen 4 → set `onboardingComplete: true`, close wizard, activate on current tab.

#### Returning user settings panel:
Same fields, editable at any time. Changes take effect on the next page scroll — no reload needed since the content script reads from storage on each classification call.

#### How the profile feeds the classifier prompt:

```python
# services/prompt.py
def build_classify_prompt(post_text: str, platform: str, profile: UserProfile) -> str:
    platform_intent = profile["platforms"][platform]["intent"]
    return f"""
You are a content classifier for a social media feed filter.

The user is on {platform} to: {platform_intent or "browse their feed"}
They want to see content about: {", ".join(profile["interests"])}
They want to avoid: {", ".join(profile["avoids"]) or "nothing specific"}
Their primary goal is to: {profile["goal"].replace("_", " ")}

Classify the following post and respond with JSON only:
{{
  "score": 0.0-1.0,
  "confidence": 0.0-1.0,
  "reason": "one sentence explanation",
  "action": "show" | "blur" | "hide"
}}

Rules:
- score > 0.6 AND confidence > 0.7 → "show"
- score < 0.2 AND confidence > 0.7 → "hide"
- everything else → "blur"
- ads, sponsored content, engagement bait → always "hide"
- if goal is "learn": reward educational threads even if slightly off-topic
- if goal is "network": reward posts from people in the user's industry
- if goal is "stay_informed": reward timely news, penalize evergreen content

Post:
{post_text}
    """.strip()
```

The `goal` field meaningfully changes classifier behavior — not just a filter label but a weighting instruction baked into the prompt.

---

### Step 4 — Feedback Loop

```
POST /feedback
Body: { post_id, action_taken, user_rating, profile_snapshot, prompt_version }
```

Store every classification + rating alongside the profile that produced it. This lets you identify not just which posts were misclassified, but *which profile configurations* tend to underperform — e.g. users whose `goal` is "network" getting worse results than "learn" users.

---

### Step 5 — Local Model (v0.3, after user retention)

```typescript
// classifier.ts hybrid routing
async function classify(post: Post, profile: UserProfile): Promise<Classification> {
  if (!webLLMLoaded) return await callAPI(post, profile);

  const local = await webLLM.classify(post, profile);

  if (local.confidence > CONFIDENCE_THRESHOLD) {
    return local;  // ~80-90% of posts end here
  }

  return await callAPI(post, profile);  // fallback for ambiguous posts
}
```

WebLLM model recommendation: **Qwen2.5-3B-Instruct** — best accuracy/size tradeoff for classification tasks as of early 2026. Download ~2GB, runs well on mid-range GPUs.

---

## Railway → Fly.io Migration

### When to migrate:
- You have users in EU or Asia-Pacific experiencing >300ms latency
- You're seeing Railway cold starts affecting classification speed
- Monthly Railway bill exceeds ~$50 (signal you're at meaningful scale)

### Migration is low-risk because:
- Same Docker container, no code changes needed
- Fly.io reads your existing Dockerfile
- DNS cutover is the only user-facing change

### Fly.io setup when ready:
```bash
fly launch                          # Detects Dockerfile automatically
fly regions add lhr syd nrt         # London, Sydney, Tokyo
fly scale count 2 --region iad      # 2 instances in US-East, no cold starts
fly postgres create                 # Managed Postgres, replaces SQLite
fly redis create                    # Upstash Redis via Fly extension
```

### Regional routing strategy:
```
US users    → iad (Virginia)
EU users    → lhr (London)
APAC users  → nrt (Tokyo) or syd (Sydney)
```

Fly.io routes to nearest region automatically via anycast. Classification latency drops from ~200ms to ~40ms for non-US users. This matters for UX — posts blur then unblur as you scroll, and you want that to feel instant.

---

## Environment Variables

```bash
# api/.env.example

# AI
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-haiku-4-5-20251001
CONFIDENCE_THRESHOLD=0.7

# Auth
API_SECRET=your-secret-key-here      # Extension uses this to auth to your API
JWT_SECRET=...                        # For future user accounts

# Infrastructure
REDIS_URL=redis://...
DATABASE_URL=sqlite:///./dev.db       # Swap for postgres in prod
ENVIRONMENT=development               # development | production

# Rate limits
FREE_TIER_DAILY_LIMIT=50
```

---

## Prompt Versioning

Track prompts like code. Every change gets a version, every version gets a reason.

```
prompts/
├── v1_classify.txt      # Initial prompt
├── v2_classify.txt      # Added: better ad detection
├── v3_classify.txt      # Added: confidence calibration instructions
└── CHANGELOG.md
```

```markdown
# Prompt Changelog

## v3 — 2026-04-01
- Added explicit confidence calibration instructions
- Result: cloud fallback rate dropped from 22% to 14%

## v2 — 2026-03-20
- Improved ad/sponsored content detection
- Result: false negatives on ads dropped from 18% to 4%
```

The `prompt_version` field in every `/classify` response lets you correlate user feedback to specific prompt versions in your analytics.

---

## Testing Strategy

```bash
# Before any prompt change, run against profile-varied fixtures:
python scripts/test_classify.py \
  --prompt prompts/v3_classify.txt \
  --fixtures tests/fixtures/ \
  --compare prompts/v2_classify.txt    # Diff accuracy between versions

# Fixtures should cover all 4 goal types and all 3 platforms:
# tests/fixtures/
# ├── twitter_goal_learn.csv
# ├── twitter_goal_network.csv
# ├── twitter_goal_stay_informed.csv
# ├── linkedin_goal_network.csv
# └── instagram_goal_learn.csv

# Target benchmarks:
# Precision (relevant posts shown):          > 85%
# Recall (irrelevant posts hidden):          > 80%
# Accuracy variance across goal types:       < 10%   ← new: goals should perform evenly
# Cloud fallback rate:                       < 20%
# p95 API response time:                     < 300ms
```

---

## Chrome Web Store Checklist (before MVP submission)

- [ ] Privacy policy hosted at your domain (required)
- [ ] Minimal permissions — only request what you actually use
- [ ] No remote code execution (MV3 requirement — you're compliant)
- [ ] Extension description mentions AI content filtering clearly
- [ ] Screenshots show before/after feed states
- [ ] Test on Chrome stable, Chrome Beta, and Arc

---

## Cost Projections

| Users | Cloud calls/day | Est. Anthropic cost/mo | Railway/Fly cost/mo | Total |
|---|---|---|---|---|
| 100 active | ~1,000 | ~$0.60 | $5 | ~$6 |
| 1,000 active | ~10,000 | ~$6 | $5 | ~$11 |
| 10,000 active | ~100,000 | ~$60 | $20 | ~$80 |
| 50,000 active | ~500,000 | ~$300 | $50 → migrate | ~$350 |

At 50k users with 10% on Pro ($4.99): ~$25k MRR vs ~$350 infra cost. Margin holds.

---

## First Week Checklist

- [ ] Create monorepo, push to GitHub
- [ ] Define `UserProfile` type in `shared/profile.ts` with defaults
- [ ] Set up `prompts/v1_classify.txt` and `scripts/test_classify.py`
- [ ] Collect 100 real tweets across 5 topic categories for fixtures
- [ ] Iterate prompt until accuracy > 80% on fixtures across all 4 goal types
- [ ] Scaffold FastAPI with `/classify` and `/health` endpoints
- [ ] Deploy to Railway, get a live URL
- [ ] Build 4-screen onboarding wizard in popup
- [ ] Build returning-user settings panel in popup
- [ ] Build Twitter/X MutationObserver + post extractor
- [ ] Wire content script → reads profile from storage → calls API → blur/hide/show UI
- [ ] Load extension unpacked in Chrome, complete onboarding, test on real Twitter feed
- [ ] Fix everything that's broken

---

*Doomscroll4 — Scroll smarter. Not harder.*
