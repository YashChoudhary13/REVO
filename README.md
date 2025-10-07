# REVO 🚀

An intelligent Chrome extension that transforms GitHub repositories into AI-explained projects — instantly.  
Adds a **REVO** button next to GitHub’s Watch button that opens a sleek overlay for repo analysis, powered by React + Groq AI.

---

## 🔥 Features by Development Day

### Day 1 — Setup & Overlay Launch
- Chrome Extension (Manifest v3) created.
- Vite + React bootstrapped.
- Injected **REVO** button beside GitHub’s Watch button.
- On click → opens a bottom overlay (75% screen height) with:
  - **REVO React app** (iframe)
  - **Pop Out** button for tab view
  - **Close** button for dismissal

### Day 2 — Overlay Polish & Interaction
- Fully responsive overlay with GitHub-style dark UI.
- Added draggable **3-dot handle** for resizing.
- Smooth slide-in/out transitions using CSS transforms.
- Snap-to-size “bottom sheet” feel.
- Velocity detection for “flick to dismiss.”

### Day 3 — Smart Repo Intelligence Engine 🧠
- Built **Hybrid Pipeline** for repo analysis.
- Auto-detects language (Node, Python, Java, Go, Rust, etc.).
- Weighted file scoring selects only the most relevant files (readme, configs, entry points, etc.).
- Generates AI-ready JSON payload for backend summarization.
- UI styled with Tailwind and GitHub-native visuals.

### Day 4 — AI Integration (Groq/OpenAI Backend)
- Created `/api/analyzeRepo` endpoint (Groq-powered).
- Flexible input parsing (`repoSummary + selectedFiles` or `repo + samples`).
- Returns structured `{ summary, latency, tokens, model }`.
- Added environment-driven config with `.env.local` and Vercel support.

### Day 5 — Performance & Optimization
- Heavy repo analysis offloaded to a **Web Worker** for smooth UI.
- Batching via `startTransition()` for non-blocking updates.
- Lazy Markdown rendering for AI summaries.
- Reduced snippet payloads (3k → 1k chars).
- Concurrency-limited fetch for faster, lag-free analysis.

### Day 6 — Ask REVO, Deployment & Final Polish ✨
- Added `Ask REVO` feature (Q&A via `/api/askRevo`).
- Sticky footer input for conversational follow-ups.
- Polished dark mode, improved spacing & readability.
- Deployed to Vercel (prod-ready with env-based config).
- Added final documentation: [DEVLOG.md](DEVLOG.md), README, and CHANGELOG.

---

## 🧠 Core Features
- **Smart Repo Analysis** — Detects repo type & fetches high-value files only.
- **AI Summarization** — Groq/OpenAI-based structured summary (Overview, Components, Tech Stack).
- **Safe by Design** — Redacts API keys & secrets before processing.
- **Blazing Fast** — Offloaded processing via Web Workers + throttled fetch.
- **Ask REVO** — Interactive Q&A on the analyzed repo.
- **Deploy Anywhere** — Works on localhost, Vercel, or Chrome extension context.

---

## 🛠 Tech Stack
- **Frontend:** React (Vite, TailwindCSS)
- **Backend:** Groq / OpenAI (Vercel Functions)
- **Extension:** Manifest v3, vanilla JS injection
- **Infra:** Vercel + .env-based environment separation

---

## 📂 Project Structure

📁 REVO  
 ┣ 📁 public  
 ┃ ┣ 📄 manifest.json  
 ┃ ┣ 📄 content.js  
 ┃ ┗ 📄 content.css  
 ┣ 📁 src  
 ┃ ┣ 📄 App.jsx  
 ┃ ┣ 📄 main.jsx  
 ┃ ┣ 📄 index.css  
 ┃ ┗ 📁 worker  
 ┃   ┗ 📄 repoWorker.js  
 ┣ 📁 api  
 ┃ ┣ 📄 analyzeRepo.ts  
 ┃ ┗ 📄 askRevo.ts  
 ┣ 📄 package.json  
 ┣ 📄 README.md  
 ┗ 📄 DEVLOG.md  

---

## ⚡️ Getting Started

1. **Clone the repo**
   ```bash
   git clone https://github.com/yourname/REVO.git
   cd REVO
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run locally**
   ```bash
   npm run dev
   # or
   npx vercel dev
   ```

4. **Build extension**
   ```bash
   npm run build
   ```

5. **Load into Chrome**
   - Open `chrome://extensions/`
   - Enable **Developer Mode**
   - Click **Load unpacked**
   - Select the `dist/` folder

6. **Test it**
   - Open any GitHub repository.
   - You’ll see a new **REVO** button beside **Watch** — click to open your AI-powered overlay.

---

## 🧩 Environment Variables
```
GROQ_API_KEY=your_groq_api_key
VITE_API_BASE=http://localhost:3000
```
> ⚠️ Do **not** commit `.env.local`. Add it to `.gitignore`.

---

## 📘 Additional Resources
- Full development journal in [DEVLOG.md](DEVLOG.md)
- Issues & Contributions welcome — PRs are reviewed weekly.

---

## 🏁 Version
**v0.1.0 — Initial Public Release**  
Includes Groq integration, Web Worker analysis, and Ask REVO feature.
