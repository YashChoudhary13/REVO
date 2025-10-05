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

### Challenges Solved:
- Missing CLI in Tailwind v4 (had to downgrade to v3.4.13 for stability).
- GitHub API rate limits for public repos (considering caching/token support later).

### Learnings:
- How to design a language-agnostic repo analyzer using heuristics.
- Importance of balancing performance with data richness.
- Refined understanding of Tailwind, PostCSS, and Vite integration in Chrome extensions.