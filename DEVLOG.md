# REVO Development Log
This file documents the day-by-day build process, challenges faced, and how we solved them.

---

## Day 1 – Setup & First Overlay

### 🔥 Highlights
- Chrome Extension (Manifest v3) created.
- Vite + React app bootstrapped.
- Content script injected a new **REVO** button next to GitHub’s Watch button.
- Clicking button opened a basic overlay with iframe, Close, and Pop Out.

### Challenges Solved:
- Ensured iframe loads React build via `chrome.runtime.getURL`.
- Button placed properly into GitHub’s `ul.pagehead-actions`.

---

## Day 2 – Overlay Styling & Interaction

### 🔥 Highlights
- Polished overlay with CSS transitions & responsive sizing.
- Added dark top bar styled like GitHub’s native UI.
- Added draggable **3-dot handle** for resizing.
- Auto-close when dragged fully down (like mobile bottom sheets).
- Velocity detection for “flick to dismiss.”
- Snap-to-size behavior for smooth UX.

### Challenges Solved:
- Fixed drag math (initially inconsistent when dragging down).
- Switched from `mousemove` → **pointer events** with `setPointerCapture`.
- Used `requestAnimationFrame` for smooth height updates.
- Balanced flex layout so 3-dot handle is **always centered**.

---

## Day 3 — The Hybrid Pipeline & Smart Sampling Engine 🧠

### 🔥 Highlights
- Completed **Hybrid Repo Intelligence System**
  - REVO can now analyze any GitHub repository structure in real-time.
  - Fetches metadata, file tree, README, and key code/config files.
  - Works seamlessly even if a repository has no README file.
- Built **Smart File Selection v2**
  - Added dynamic, weighted file scoring inspired by real-world developer heuristics.
  - Detects project type automatically (Node, Python, Java, Go, Rust, etc.).
  - Samples only high-value files like configs, entry points, core logic, and documentation.
- Prepared **AI-ready payload structure**
  - Includes repo metadata, detected type, and file content snippets.
  - Ready for direct OpenAI or local AI backend integration (Day 4 goal).
- Enhanced Tailwind setup and UI consistency.
  - Tailwind CSS integrated successfully inside Vite.
  - Visuals are now GitHub-native with light/dark adaptability.

### ⚙️ Technical Flow Implemented
1. **Data Collection**
   - `GET /repos/{owner}/{repo}` → metadata
   - `GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1` → file structure
   - Optional: `GET /repos/{owner}/{repo}/readme` → README content

2. **Dynamic File Sampling**
   - Weighted scoring system (README, main code files, configs, docs).
   - Filters out junk (binary/media/lock files).
   - Selects up to 15 best files for analysis.

3. **Payload Preparation**
   ```json
   {
     "repo": "user/repo",
     "detectedType": "Node / JS",
     "metadata": {
       "stars": 123,
       "forks": 10,
       "language": "JavaScript",
       "branch": "main"
     },
     "filesAnalyzed": 12,
     "samples": [
       { "path": "package.json", "snippet": "..." },
       { "path": "src/App.jsx", "snippet": "..." }
     ]
   }
   ```

### Challenges Solved:
- Missing CLI in Tailwind v4 (had to downgrade to v3.4.13 for stability).
- GitHub API rate limits for public repos (considering caching/token support later).

### Learnings:
- How to design a language-agnostic repo analyzer using heuristics.
- Importance of balancing performance with data richness.
- Refined understanding of Tailwind, PostCSS, and Vite integration in Chrome extensions.

---

## Day 4 — AI Handoff & Summary Generation (backend + front-end wiring)

### 🔥 Highlights
- Implemented the AI handoff flow: frontend prepares compact payload and sends it to `/api/analyzeRepo`.
- Created a production-ready Groq-powered endpoint (`api/analyzeRepo`) with flexible input parsing.
- Supported both legacy (`repoSummary` + `selectedFiles`) and new (`repo` + `samples`) payload shapes.
- Local dev + Vercel production support: `.env.local` for secrets, Vercel envs for production keys.
- Quick verification and hardening: CORS headers, diagnostic logs, and structured JSON response (`{ summary, latency, tokens, model }`).

### ⚙️ Technical flow implemented
1. Frontend prepares `payload` (repo metadata + truncated file snippets).
2. POST to `/api/analyzeRepo` with either:
   - `{ repoSummary, selectedFiles }` (legacy), or
   - `{ repo, samples }` (new-style).
3. Backend normalizes inputs, builds an expert prompt and calls the LLM (Groq / configured model).
4. Backend returns tidy JSON with summary + metrics; frontend renders Markdown.

### Files added / changed
- `api/analyzeRepo.ts` — robust Groq/OpenAI endpoint, flexible schema, logging, and error handling.
- `src/App.jsx` — wired the `handleAIHandoff()` to call the new endpoint, added loading & error UX.
- `.env.local` — local env file (not committed) for `GROQ_API_KEY`, `VITE_GITHUB_TOKEN`, `VITE_API_BASE`.

### Challenges solved
- **Missing credentials error**: local dev initially failed with “Missing credentials”. Fix: ensure `.env.local` contains `GROQ_API_KEY` / `OPENAI_API_KEY` and is loaded by the dev server.
- **Payload mismatch**: front-end and back-end used different field names. Fix: backend accepts both shapes and normalizes.
- **CORS**: extension + overlay required permissive CORS for local testing. Fix: add temporary `Access-Control-Allow-Origin: *` (lock down in production).

### Example `.env.local`
```
VITE_GITHUB_TOKEN=ghp_xxx        # optional (better rate limits)
GROQ_API_KEY=groq_xxx            # required for Groq model
VITE_API_BASE=http://localhost:3000
```
> Ensure `.env.local` is listed in `.gitignore` (do NOT commit keys).

### Learnings
- Backend must be forgiving about payload shapes during iterative frontend development.
- Always fail fast and log clearly — token/missing keys are common during local->prod transitions.

---

## Day 5 — Performance: Web Worker, batching, truncation & lazy rendering

### 🔥 Highlights
- Offloaded heavy repo analysis to a **Web Worker** (`src/worker/repoWorker.js`) to eliminate UI jank.
- Introduced concurrency-limited fetches inside the worker to avoid network/CPU bursts.
- Used `startTransition()` to batch non-urgent React state updates.
- Reduced snippet payload size (default → **1000 chars**) to significantly cut memory & render cost.
- Lazy-loaded `react-markdown` (React.lazy + Suspense) to avoid blocking paint on summary render.

### ⚙️ Technical flow implemented
1. `App.jsx` attempts to initialize a module worker via `new Worker(new URL(...), { type: 'module' })`.
2. If worker available:
   - Post `{ owner, repo, token, sampleLimit, maxSnippetLength, concurrency }`.
   - Worker returns `{ payload, preview }` via `postMessage`.
   - Frontend uses `startTransition()` to set payload/preview non-urgently.
3. If worker blocked (CSP / extension):
   - Fallback to `fetchRepoDataInline()` scheduled inside `requestIdleCallback` to avoid blocking UI.
4. Markdown component loaded lazily with `Suspense` fallback.

### Files added / changed
- `src/worker/repoWorker.js` — worker implementation: fetch metadata, tree, scoring, fetch snippets, redact secrets.
- `src/App.jsx` — worker wiring, worker-first `useEffect`, inline fallback, `startTransition` usage, lazy `ReactMarkdown` import.
- reduced default snippet length and posted `maxSnippetLength` in worker message.

### Challenges solved
- **Popup / overlay freeze**: fixed by offloading parse & fetch to worker.
- **Re-render spikes**: fixed by batching and making large updates low-priority.
- **CSP / extension concern**: Worker init can fail in some extension contexts — we added a robust idle-time inline fallback.
- **Large payloads**: reduced snippet size from 3000 → 1000 chars, greatly lowering memory pressure.

### Validation & profiling
- Verified the worker thread appears under DevTools → Sources → Threads.
- Used Performance panel: main thread activity reduced during analysis, most heavy IO/parse work visible in worker thread.
- Confirmed that adding `startTransition()` and `Suspense` smoothed UI paints and reduced jank.

### Learnings
- Web Workers dramatically improve responsiveness for CPU-bound parsing tasks.
- Even with workers, batching state updates matters — many React updates still create reconciliation overhead.
- Always plan an inline fallback: extensions / CSP rules can block workers.

---

## Day 6 — Ask REVO (conversational queries), deployment & final polish

### 🔥 Highlights
- Built conversational follow-ups: `api/askRevo` endpoint — take `summary + samples + question` → return repo-aware answer.
- Enabled interactive footer UI: user can ask follow-up questions and get answers appended to the summary.
- Polished UI: fixed whitespace, full-width layout, improved line-height and spacing, and sticky footer avoiding odd bottom whitespace.
- Production deploy to Vercel; environment variables configured in the Vercel dashboard (`GROQ_API_KEY`, `VITE_API_BASE`, etc).
- Finalized README feature list, DEVLOG entries, and a clean commit for release.

### ⚙️ Technical flow implemented
1. User types a question and submits the footer form.
2. Frontend posts to `/api/askRevo`:
   ```json
   { "summary": "<aiSummary>", "samples": [ { "path","snippet" } ], "question": "..." }
   ```
3. Backend composes a context prompt and calls the LLM; returns `{ answer }`.
4. Frontend appends the Q&A to `aiSummary`, keeping conversation history.

### Files added / changed
- `api/askRevo.ts` — Q&A endpoint that reuses summary + samples as context for targeted answers.
- `src/App.jsx` — footer form (enabled), `handleAskRevo()` implementation, conversational append logic.
- README updated with usage and API descriptions; `DEVLOG.md` updated (this file).

### Deployment notes
- Do **not** hardcode production URLs. Use `VITE_API_BASE` and `API_BASE` resolution in frontend:
  - Dev: `http://localhost:3000`
  - Extension: `VITE_API_BASE` (production domain)
  - Production build: `VITE_API_BASE` or default production domain
- On Vercel: set the environment variables (`GROQ_API_KEY`, `VITE_API_BASE`, optionally `VITE_GITHUB_TOKEN`) in the project settings.
- Vercel preview/prod deployments each get unique URLs — use `VITE_API_BASE` to point your extension to the production endpoint if needed.

### Challenges solved
- **Perceived lag on AI handoff**: clarified that remaining lag came from network/LLM latency; provided UI loading state and latency/tokens in response.
- **Multiple prod URLs from Vercel**: configured env var and dynamic API base resolution; do not hardcode a specific deployment URL in code.
- **Cost & API quotas**: confirmed that production usage requires valid Groq/OpenAI keys and that the OpenAI account needs funds for continuous heavy usage (noted as operational consideration).

### Final polish & docs
- Updated README with quickstart, API endpoints, and feature list.
- Added a CHANGELOG and release note for v0.1.0.
- Created a concise commit message for the release.

### Learnings
- Final UX polish (spacing, line-height, sticky footer) has outsized impact on perceived quality.
- Production readiness requires careful env management and fallback strategies for extension constraints.
- Keep LLM costs in mind when shipping "Ask" features—design guardrails (rate limits, size-limits) for commercial use.

---

## Overall mistakes we made (recap) & how we fixed them
- **Forgotten API key** — fixed by `.env.local` + clearer startup logs and preflight checks.
- **Frontend/backend payload mismatch** — fixed by designing a forgiving, normalized backend interface.
- **Synchronous heavy work on main thread** — fixed with Web Worker + idle fallback.
- **Worker CSP in extension** — mitigated with inline fallback & notes for potential blob worker shim.
- **Large state payloads causing re-renders** — fixed by truncating snippets, batching updates, and lazy-loading heavy components.

---

## 🧩 Day 7 — REVO v2 Kickoff: PR Page Integration & Lifecycle Fix

### 🏁 Goal
Today marks the start of **REVO v2**, where we’re expanding our extension beyond repo analysis into **intelligent Pull Request (PR) support**.  
The vision is to make REVO act like an **AI reviewer** — analyzing PRs, suggesting architectural improvements, and detecting potential risks in code changes.

---

### ⚙️ What We Worked On
We began by setting up REVO to **detect and function inside GitHub Pull Request pages**.

**Key steps:**
1. **PR Detection Logic**  
   Implemented logic to identify when the user is on a PR page (`/pull/{id}`).

2. **Dynamic Button Injection**  
   Added a “Run REVO” button in the PR header (`.gh-header-actions`) for instant access.

3. **SPA-Aware Architecture**  
   GitHub uses a *Single Page Application* (PJAX) — no full page reloads between navigation.  
   To handle this, we implemented a **MutationObserver + URL watcher hybrid**, allowing REVO to:
   - Detect in-page URL changes  
   - Re-inject itself when DOM content changes dynamically  
   - Stay consistent across PR tabs (Conversation, Commits, Files Changed)

4. **Unified Logic for Repo + PR Pages**  
   Merged our older repo logic and the new PR logic into one clean, dynamic architecture.  
   REVO can now adapt to the current page context automatically.

---

### 🪲 The Bug We Discovered
When loading GitHub **directly on a repo page** (e.g., refreshing or opening from bookmark),  
REVO didn’t inject its button on first load.

**Root Cause:**  
`onUrlChange()` skipped execution since `lastUrl` equaled `location.href` at startup.  
The code only triggered when the URL changed — which doesn’t happen during an initial load.

**✅ Fix:**  
Force-trigger the first run by resetting `lastUrl` before initialization:

```js
lastUrl = "";
onUrlChange();



## Next steps & optional roadmap (future work)
- Persistent Cache - Cache repo analysis (tree + sample files) in IndexedDB to skip re-fetch on same repo
- History View - Show previous analyzed repos in sidebar
- Better markdown rendering - Use rehype-highlight for syntax-colored code blocks
- Shareable Link - Generate a permalink to the summary
- Model switcher (Groq / OpenAI) - Dropdown to select model source
