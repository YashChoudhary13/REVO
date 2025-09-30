# REVO 🚀

A Chrome extension that adds a custom **REVO** button to GitHub repositories.  
Clicking the button opens a bottom overlay (75% of screen) powered by a React app, with options to **Pop Out** into a new tab or **Close**.

---

## 🔥 Features (Day 1)
- Chrome Extension (Manifest v3)
- Vite + React setup
- Injects REVO button next to **Watch** on GitHub repo pages
- On click → opens overlay with:
  - REVO React app (iframe)
  - Close button
  - Pop Out button

---

## 📂 Project Structure

📁 REVO  
 ┣ 📁 public  
 ┃ ┣ 📄 manifest.json   
 ┃ ┗ 📄 content.js       
 ┣ 📁 src  
 ┃ ┣ 📄 App.jsx          
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