# REVO Development Log
This file documents the day-by-day build process, challenges faced, and how we solved them.

---

## Day 1 – Setup & First Overlay

**Highlights:**
- Chrome Extension (Manifest v3) created.
- Vite + React app bootstrapped.
- Content script injected a new **REVO** button next to GitHub’s Watch button.
- Clicking button opened a basic overlay with iframe, Close, and Pop Out.

**Challenges Solved:**
- Ensured iframe loads React build via `chrome.runtime.getURL`.
- Button placed properly into GitHub’s `ul.pagehead-actions`.

---

## Day 2 – Overlay Styling & Interaction

**Highlights:**
- Polished overlay with CSS transitions & responsive sizing.
- Added dark top bar styled like GitHub’s native UI.
- Added draggable **3-dot handle** for resizing.
- Auto-close when dragged fully down (like mobile bottom sheets).
- Velocity detection for “flick to dismiss.”
- Snap-to-size behavior for smooth UX.

**Challenges Solved:**
- Fixed drag math (initially inconsistent when dragging down).
- Switched from `mousemove` → **pointer events** with `setPointerCapture`.
- Used `requestAnimationFrame` for smooth height updates.
- Balanced flex layout so 3-dot handle is **always centered**.

---

➡️ Next: **Day 3** → Inside the iframe React app (branding header, feature buttons, and message passing).
