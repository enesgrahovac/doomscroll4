# DESIGN SYSTEM
*Doomscroll4 — visual language reference*

> This doc is the source of truth for all visual decisions. Claude Code should read this before building any UI component. All values here map directly to `tokens.css` and `shared/tokens.ts`.

---

## Color Tokens

One accent color drives the entire UI. To recolor the product, change `--ds4-accent` in `tokens.css` and `accent` in `tokens.ts`. Everything else is derived.

```css
/* extension/src/styles/tokens.css */
:root {
  /* Accent — the one value to change for a full recolor */
  --ds4-accent:        #00ff88;
  --ds4-accent-dim:    #00ff8822;
  --ds4-accent-mid:    #00cc66;
  --ds4-accent-glow:   0 0 8px #00ff8844;

  /* Base grays — never change these */
  --ds4-bg:            #0d0d0d;
  --ds4-bg-raise:      #111111;
  --ds4-bg-raise-2:    #161616;
  --ds4-border:        #1e1e1e;
  --ds4-border-bright: #2a2a2a;

  /* Text */
  --ds4-text:          #cccccc;
  --ds4-text-dim:      #666666;
  --ds4-text-bright:   #eeeeee;

  /* Semantic — feed states */
  --ds4-show:          var(--ds4-accent);
  --ds4-show-bg:       var(--ds4-accent-dim);
  --ds4-blur-fg:       #555555;
  --ds4-blur-bg:       #ffffff08;
  --ds4-hide-fg:       #ff4444;
  --ds4-hide-bg:       #ff000011;
}
```

```typescript
// extension/src/shared/tokens.ts
export const TOKENS = {
  accent:      '#00ff88',
  accentDim:   '#00ff8822',
  accentMid:   '#00cc66',
  accentGlow:  '0 0 8px #00ff8844',
  bg:          '#0d0d0d',
  bgRaise:     '#111111',
  bgRaise2:    '#161616',
  border:      '#1e1e1e',
  text:        '#cccccc',
  textDim:     '#666666',
  textBright:  '#eeeeee',
  show:        '#00ff88',
  showBg:      '#00ff8822',
  blurFg:      '#555555',
  blurBg:      '#ffffff08',
  hideFg:      '#ff4444',
  hideBg:      '#ff000011',
} as const;
```

---

## Typography

Two fonts. One for UI chrome, one for body content.

```css
/* Pixel display font — headers, badges, extension popup title */
font-family: 'Press Start 2P', monospace;

/* Mono body font — post summaries, settings labels, all readable text */
font-family: 'Share Tech Mono', monospace;
```

Import in popup HTML:
```html
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Share+Tech+Mono&display=swap" rel="stylesheet">
```

| Use | Font | Size |
|---|---|---|
| Extension name / logo | Press Start 2P | 10px |
| Badge labels (FEED / BLUR / EAT) | Press Start 2P | 7px |
| Section headers in popup | Press Start 2P | 8px |
| Body text, post summaries | Share Tech Mono | 12px |
| Dimmed labels, metadata | Share Tech Mono | 11px |

---

## Feed State Components

### Show state
Post renders normally. No modification. Optionally a faint left border accent on hover to indicate the extension saw and approved it.

```css
.ds4-show {
  border-left: 2px solid var(--ds4-accent-dim);
}
```

### Blur state
Post content blurred. Overlay shows a one-line text summary from the classifier and a "Show me" button. Clicking reveal removes the blur permanently for that post.

```css
.ds4-blur-wrapper {
  position: relative;
}
.ds4-blur-wrapper .ds4-blur-content {
  filter: blur(6px);
  pointer-events: none;
  user-select: none;
  opacity: 0.4;
}
.ds4-blur-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: var(--ds4-blur-bg);
  backdrop-filter: blur(2px);
}
.ds4-reveal-btn {
  font-family: 'Press Start 2P', monospace;
  font-size: 7px;
  color: var(--ds4-text-dim);
  border: 1px solid var(--ds4-border-bright);
  background: transparent;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 2px;
}
.ds4-reveal-btn:hover {
  color: var(--ds4-accent);
  border-color: var(--ds4-accent);
}
```

### Hide state
Post collapsed to 28px bar. Shows "1 post hidden" label and a faint expand chevron. Clicking expands it once — does not re-classify.

```css
.ds4-hide-wrapper {
  height: 28px;
  overflow: hidden;
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 8px;
  opacity: 0.35;
  cursor: pointer;
  border-left: 2px solid var(--ds4-hide-fg);
}
.ds4-hide-wrapper:hover {
  opacity: 0.6;
}
.ds4-hide-label {
  font-family: 'Press Start 2P', monospace;
  font-size: 6px;
  color: var(--ds4-hide-fg);
}
```

### Badge labels
| State | Label | Color |
|---|---|---|
| Show | FEED | `--ds4-accent` |
| Blur | BLUR | `--ds4-blur-fg` |
| Hide | EAT | `--ds4-hide-fg` |

"EAT" instead of "HIDE" — the gremlin ate it. Consistent with the brand mechanic.

---

## The Gremlin

### Name
**GREM** — short, punchy, works as a proper noun. "Grem ate it." "Feed Grem." "Grem is hungry."

### Personality
Chaotic little monster. Mischievous and unpredictable. Comes alive when eating bad posts, idle and impatient when the feed is clean. Never cute in a soft way — always slightly feral.

### Emotional states
| State | When | Expression |
|---|---|---|
| Idle | Feed is paused / extension just opened | Blinking slowly, tapping foot |
| Hungry | Scrolling but no bad posts found yet | Eyes darting, drooling slightly |
| Eating | Bad post hidden | Chomping animation, eyes wide |
| Satisfied | After eating 3+ posts in a session | Leaning back, toothpick |
| Angry | Classification confidence is low | Eyebrows furrowed, question mark above head |

### Pixel art spec
- **Canvas size:** 16×16 grid, rendered at 10px per pixel = 160×160px display
- **Rendering:** `image-rendering: pixelated` always — never smooth-scale
- **Colors:** body uses `--ds4-bg-raise-2`, eyes use `--ds4-accent`, horns use `--ds4-accent-mid`, tongue uses `--ds4-hide-fg`
- **Draw function signature:**
```typescript
drawGremlin(canvas: HTMLCanvasElement, state: GremlinState, tokens: typeof TOKENS): void
```

### Placement
- Extension popup header: 32×32px (3px per pixel grid)
- Chrome toolbar icon: 16×16px and 32×32px exports
- Onboarding screens: 80×80px centered
- "Eating" animation: triggered on every hide action, 400ms chomp loop

---

## Extension Popup Layout

```
┌─────────────────────────────┐
│ [GREM 32px] DOOMSCROLL4     │  ← Press Start 2P, accent color
│              ● ACTIVE       │  ← blinking dot when on
├─────────────────────────────┤
│ TODAY                       │  ← session stats
│ 12 fed · 8 blurred · 31 ate │
├─────────────────────────────┤
│ YOUR GREMLIN IS HUNGRY      │  ← gremlin status line
├─────────────────────────────┤
│ [⚙ SETTINGS]  [? HELP]     │  ← footer actions
└─────────────────────────────┘
```

Popup dimensions: 320×240px. Fixed size, no resize.

---

## Onboarding Screens

4 screens, same layout each:

```
┌─────────────────────────────┐
│         [GREM 80px]         │
│                             │
│   WHAT DO YOU CARE ABOUT?   │  ← Press Start 2P, 8px
│                             │
│   [ input / options ]       │
│                             │
│   ░░░█░░░░  2 of 4         │  ← pixel progress bar
│              [ NEXT → ]     │
└─────────────────────────────┘
```

Progress bar uses accent color for filled segments, `--ds4-border` for empty.

---

## Animation Principles

- **Pixel-snap all movement** — no sub-pixel transitions. Move in whole pixel increments.
- **Fast and snappy** — 150ms max for UI state changes. The feed moves fast, the UI should too.
- **Eating animation** — the one place to go big. 400ms, 3-frame chomp cycle on hide actions.
- **Blink** — gremlin eyes blink every 3–5 seconds randomly. CSS keyframes, no JS needed.
- **No easing curves** — use `steps()` for pixel art animations to preserve the chunky feel.

```css
@keyframes chomp {
  0%   { transform: translateY(0); }
  25%  { transform: translateY(-2px); }
  50%  { transform: translateY(0); }
  75%  { transform: translateY(-1px); }
  100% { transform: translateY(0); }
}

.ds4-eating {
  animation: chomp 400ms steps(1) 1;
}
```

---

## What Not To Do

- **No rounded corners above 3px** — keeps the pixel aesthetic sharp
- **No gradients** — flat colors only
- **No smooth image scaling on the gremlin** — always `image-rendering: pixelated`
- **No white backgrounds anywhere** — the extension overlays on bright social media pages; the popup must feel like a different world
- **No Inter, Roboto, or system fonts** — Press Start 2P and Share Tech Mono only
- **No soft shadows** — use `box-shadow` with the accent glow variable or nothing

---

*To recolor the entire product: change `--ds4-accent` in `tokens.css` and `accent` in `tokens.ts`.*
