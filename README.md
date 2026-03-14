# DOOMSCROLL4

**Scroll smarter. Not harder.**

Doomscroll4 is a Chrome extension that makes social media scrolling intentional. It reads each post using AI and filters your feed against your own stated goals — surfacing what matters, blurring the borderline, and collapsing the noise.

It doesn't block social media. It makes you the algorithm.

## How It Works

You build a profile telling Doomscroll4 what you care about:

- **Interests** — topics you want to see
- **Goal** — why you're on this platform (learn, stay informed, network)
- **Avoids** — what you explicitly don't want

Every post in your feed gets one of three treatments:

| State | When | What You See |
|---|---|---|
| **Show** | High relevance | Post renders normally |
| **Blur** | Borderline | Blurred with a summary and a "Show me" button |
| **Hide** | Off-topic or ad | Collapsed to a thin bar (Grem ate it) |

The blur state is the key — it breaks the passive scroll loop by making you opt in to borderline content.

## Architecture

```
extension/          Chrome Extension (TypeScript, Manifest V3)
├── src/content/    MutationObserver + platform adapters + UI states
├── src/popup/      Onboarding wizard + settings panel
└── src/shared/     Profile types, storage, design tokens

api/                FastAPI backend (Python)
├── routers/        /classify, /feedback, /auth endpoints
├── services/       Anthropic API calls, rate limiting, prompt logic
└── models/         Pydantic schemas

prompts/            Versioned classification prompts
scripts/            Prompt testing harness + fixtures
```

**Extension → API → Claude AI → Classification**

The extension extracts post text, sends it to the backend with your profile, and the API uses Claude to classify relevance. API keys and prompt logic live server-side — the extension is a UI layer, the backend is the brain.

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 18+
- Chrome browser
- An [Anthropic API key](https://console.anthropic.com/)

### Backend

```bash
cd api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Configure
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# Run
uvicorn main:app --reload --port 8080
```

### Extension

```bash
cd extension
npm install
npm run build
```

Then load the extension in Chrome:

1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension/dist` directory

### Prompt Testing

Test classification quality before touching the extension:

```bash
python scripts/test_classify.py --prompt prompts/v1_classify.txt --fixtures scripts/fixtures/twitter_posts.csv
```

## Supported Platforms

- **Twitter/X** — MVP, active development
- LinkedIn — planned
- Instagram — planned

## The Gremlin

Meet **Grem** — a chaotic little pixel-art monster that lives in your toolbar. Grem eats the bad posts. When your feed is clean, Grem gets hungry. When junk floods in, Grem feasts.

## Tech Stack

- **Extension:** TypeScript, Webpack, Chrome Manifest V3
- **Backend:** FastAPI, Python 3.12
- **AI:** Claude (Anthropic API) for post classification
- **Design:** Pixel-art aesthetic — Press Start 2P + Share Tech Mono, dark theme, #00ff88 accent

## Contributing

Contributions are welcome! This project is in early development — check the issues for good first tasks.

## License

[MIT](LICENSE)

---

*Doomscroll4 — Scroll smarter. Feed your gremlin.*
