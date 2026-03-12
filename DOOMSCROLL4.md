# DOOMSCROLL4
*Scroll smarter. Not harder.*

> This is the foundation document. It captures what we're building and why — not how we're building it or what we're charging. Those live in `DOOMSCROLL4_PLAN.md`. This doc should rarely need to change.

---

## What It Is

Doomscroll4 is a Chrome extension that makes social media scrolling intentional. It reads each post using AI and filters the feed against the user's own stated goals — surfacing what matters, blurring the borderline, and collapsing the noise.

It doesn't block social media. It makes you the algorithm.

---

## The Problem

Social media platforms are optimized for engagement, not value. Their algorithms surface whatever keeps eyes on screen — outrage, ads, and celebrity drama sit alongside genuine learning and meaningful connection. Users who want the latter are forced to wade through the former, and the act of wading is the trap.

**Existing solutions miss the point:**
- Feed blockers (News Feed Eradicator, etc.) remove everything — too blunt, the good goes with the bad
- Platform-level filters serve the platform's interests, not the user's
- RSS readers require active curation and miss real-time social content
- Screen time apps track usage but don't improve the quality of what's consumed

None of them solve the actual problem: there's valuable content in your feed, you just can't see it through the noise.

---

## The Solution

Doomscroll4 intercepts posts as they render and classifies each one against a profile the user builds themselves. That profile captures three things:

1. **Interests** — what topics they want to see
2. **Goal** — why they're on this platform (learn, stay informed, network)
3. **Avoids** — what they explicitly don't want

Every post gets one of three treatments:

| State | When | Experience |
|---|---|---|
| **Show** | High relevance | Post renders normally |
| **Blur** | Borderline / uncertain | Blurred with a text summary and a "Show me" button |
| **Hide** | Clearly off-topic or an ad | Collapsed to a thin dismissible bar |

The **Blur state is the core differentiator.** Every other feed cleaner makes a binary choice. Doomscroll4 preserves user agency — you can always choose to see something, but you have to opt in. That one interaction is what breaks the passive scroll loop.

---

## Who It's For

People who use social media to learn and stay informed, but find themselves walking away having consumed nothing of value. Specifically:

- Engineers and researchers who follow their field on Twitter/X
- Professionals who use LinkedIn for industry awareness but drown in engagement bait
- Curious people who want signal, not stimulation

---

## Architecture Principles

These are the decisions that should stay stable regardless of how the implementation evolves:

**1. The user's profile drives everything.**
Classification is only as good as the profile behind it. The extension is a thin interface for capturing intent. The AI is a tool for executing that intent. Neither matters without a well-formed profile.

**2. The backend owns the AI.**
API keys and prompt logic live server-side, not in the extension. This keeps keys safe and lets prompt iteration happen without an extension release cycle. The extension is a UI layer; the backend is the brain.

**3. Never remove — always preserve agency.**
Hidden posts are collapsible. Blurred posts are revealable. The user is always one click away from seeing anything. Doomscroll4 is a filter, not a wall.

**4. Platform resilience over perfect selectors.**
Social platforms change their DOM constantly. Post detection uses MutationObserver and versioned platform adapters so a markup change on Twitter breaks one file, not the whole extension.

**5. Local model is a performance optimization, not a foundation.**
The hybrid local/cloud architecture is valuable, but classification quality comes first. Build on cloud AI, add local inference once the product is working.

---

## Brand

**Voice:** Irreverent but genuinely useful. Self-aware about the problem without being preachy. The product knows you have a bad habit and isn't here to lecture you about it.

**Name logic:** "Doomscroll" is the problem. "4" means *for* — as in, scrolling for a purpose. The name is the pitch.

**Campaign hook:** Doomscroll4learning. Doomscroll4work. Doomscroll4science. Each is a different audience, same product.

---

## North Star

**Signal ratio** — the percentage of posts a user sees that they'd rate as worth their time.

Baseline without the extension: ~20–30%. Target after 30 days of active use: 70%+.

Everything we build should move this number.

---

## Decision Log

*Running record of significant calls made during development and why.*

| Date | Decision | Reason |
|---|---|---|
| 2026-03-12 | Extension + hosted API over extension-only | Keeps API keys server-side, allows prompt iteration without extension release cycle |
| 2026-03-12 | Railway for initial hosting, Fly.io when regional deployment needed | Railway gets us live fast; Fly.io gives edge deployment when we have global users |
| 2026-03-12 | Twitter/X as MVP-only platform | Most predictable DOM structure; validate core loop before adding platform complexity |
| 2026-03-12 | Cloud-only AI for v1, local model deferred to v0.3 | WebLLM onboarding friction is too high before we have user retention |

---

*Doomscroll4 — Scroll Smarter. Feed your gremlin.*
