# REVO 🚀

A Chrome extension that adds a custom **REVO** button to GitHub repositories.  
Clicking the button opens a bottom overlay (75% of screen) powered by a React app, with options to **Pop Out** into a new tab or **Close**.

---

## 🔥 Features by Development Day

### Day 1
- Chrome Extension (Manifest v3)
- Vite + React setup
- Injects REVO button next to **Watch** on GitHub repo pages
- On click → opens overlay with:
  - REVO React app (iframe)
  - Close button
  - Pop Out button

### Day 2
- Overlay styling with smooth slide-in/out animations
- Responsive design (desktop & mobile)
- Draggable resize using a 3-dot handle
- Auto-close when dragged completely down
- Snap-to-size feel like native mobile bottom sheets

### Day 3
- Integrated Hybrid Pipeline for analyzing repository structure.
- Smart weighted file selection (cross-language).
- AI-ready JSON payload creation.
- REVO now context-aware and ready for AI summary generation.

*(Full engineering journey with problems faced & solutions in [DEVLOG.md](DEVLOG.md))*
---

## 🛠 Tech Stack
- Chrome Extensions (Manifest v3)
- React + Vite
- Vanilla JS for content script
- CSS3 (responsive design, animations)

## 📂 Project Structure

📁 REVO  
 ┣ 📁 public  
 ┃ ┣ 📄 manifest.json   
 ┃ ┗ 📄 content.js  
 ┃ ┗ 📄 content.css  
 ┣ 📁 src  
 ┃ ┣ 📄 App.jsx 
 ┃ ┣ 📄 index.css         
 ┃ ┗ 📄 main.jsx  
 ┣ 📄 package.json  
 ┗ 📄 README.md

---

## ⚡️ Getting Started

1. Clone repo:
   ```bash
   git clone https://github.com/yourname/REVO.git
   cd REVO
2. Install dependencies:
    npm install
3. Build extension:
    npm run build
4. Load into Chrome:
    - Open chrome://extensions/
    - Enable Developer Mode
    - Load unpacked → select dist/ folder
5. Open any GitHub repo → see REVO button appear!