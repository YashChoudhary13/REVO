(function () {
  console.log("🚀 REVO initialized");

  // ========================
  // 1️⃣ STATE VARIABLES
  // ========================
  let lastUrl = location.href;
  let domObserver = null;

  // ========================
  // 2️⃣ HELPER FUNCTIONS
  // ========================

  // --- Get owner/repo info from URL
  function getRepoInfo() {
    const match = window.location.pathname.match(/^\/([^/]+)\/([^/]+)/);
    if (match) return { owner: match[1], repo: match[2] };
    return null;
  }

  // --- Add REVO button on repo homepage
  function addRepoButton() {
    const actionsBar = document.querySelector("ul.pagehead-actions");
    if (!actionsBar) return;
    if (document.getElementById("revo-repo-button")) return; // avoid duplicates

    const revoLi = document.createElement("li");
    const revoBtn = document.createElement("button");
    revoBtn.id = "revo-repo-button";
    revoBtn.innerText = "REVO";
    revoBtn.className = "btn btn-sm btn-with-count";
    revoBtn.style.marginLeft = "8px";

    // --- Button click logic (opens overlay)
    revoBtn.addEventListener("click", () => {
      console.log("📦 REVO button clicked (Repo page)");

      const existing = document.getElementById("revo-overlay");
      if (existing) {
        existing.classList.remove("revo-open");
        existing.classList.add("revo-closing");
        existing.addEventListener("transitionend", () => existing.remove(), { once: true });
        return;
      }

      const container = document.createElement("div");
      container.id = "revo-overlay";
      document.body.appendChild(container);

      requestAnimationFrame(() => container.classList.add("revo-open"));

      // Top bar (single strip)
      const topBar = document.createElement("div");
      topBar.className = "revo-controls"; // we style this in CSS

      // Left placeholder (optional area for logo/title; keeps layout consistent)
      const leftGroup = document.createElement("div");
      leftGroup.className = "revo-left-actions";
      leftGroup.style.flex = "1"; // occupies leftover space on the left

      // Center drag handle (ABSOLUTELY centered via CSS)
      const dragHandle = document.createElement("div");
      dragHandle.id = "revo-drag-handle";
      dragHandle.setAttribute("role", "separator");
      dragHandle.setAttribute("aria-label", "Resize REVO overlay");
      dragHandle.innerHTML = `<span></span><span></span><span></span>`;

      // Right-side actions (Pop Out + Close)
      const rightGroup = document.createElement("div");
      rightGroup.className = "revo-right-actions";

      const popOutBtn = document.createElement("button");
      popOutBtn.innerText = "↗ Pop Out";
      popOutBtn.addEventListener("click", () => {
        window.open(chrome.runtime.getURL("index.html"), "_blank");
        container.classList.remove("revo-open");
        container.classList.add("revo-closing");
        container.addEventListener("transitionend", () => container.remove(), { once: true });
      });

      const closeBtn = document.createElement("button");
      closeBtn.innerText = "✖ Close";
      closeBtn.addEventListener("click", () => {
        container.classList.remove("revo-open");
        container.classList.add("revo-closing");
        container.addEventListener("transitionend", () => container.remove(), { once: true });
      });

      rightGroup.appendChild(popOutBtn);
      rightGroup.appendChild(closeBtn);

      // Assemble the bar: left group (flex), right group (buttons).
      // Drag handle is absolutely centered by CSS (so order here doesn't matter).
      topBar.appendChild(leftGroup);
      topBar.appendChild(rightGroup);
      topBar.appendChild(dragHandle); // appended last but absolutely positioned

      container.appendChild(topBar);


      // Drag logic
      let isDragging = false;
      let startY = 0;
      let startHeight = 0;
      let minHeight = 0;
      let maxHeight = 0;
      let rafId = null;
      let lastMoveTime = 0;
      let lastMoveY = 0;
      let lastVelocity = 0;

      // configuration: tune these to taste
      const MIN_RATIO = 0.25;        // 25% of viewport = minimum shown height
      const MAX_RATIO = 0.90;        // 90% of viewport = maximum height
      const MAX_OVERDRAG = 180;      // allow up to 180px "pull down" beyond min (rubberband area)
      const CLOSE_RAW_PX = 100;      // if raw height pulled below (min - 100px) → close
      const CLOSE_VELOCITY = 0.6;    // px/ms downward velocity threshold to trigger flick-close (~600 px/s)
      const SNAP_POINTS = [0.25, 0.5, 0.9]; // snap to 25%,50%,90% if not dismissed

      function pointerDown(e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();

        isDragging = true;
        startY = e.clientY;
        startHeight = container.getBoundingClientRect().height;

        minHeight = Math.round(window.innerHeight * MIN_RATIO);
        maxHeight = Math.round(window.innerHeight * MAX_RATIO);

        lastMoveTime = performance.now();
        lastMoveY = e.clientY;
        lastVelocity = 0;

        try { dragHandle.setPointerCapture(e.pointerId); } catch (err) {}

        document.body.style.userSelect = 'none';
        document.body.style.touchAction = 'none';
      }

      function pointerMove(e) {
        if (!isDragging) return;

        // timing for velocity
        const now = performance.now();
        const dt = Math.max(1, now - lastMoveTime); // ms (avoid 0)
        const dySinceLast = e.clientY - lastMoveY;
        lastVelocity = dySinceLast / dt; // px/ms (+ve when moving down)
        lastMoveTime = now;
        lastMoveY = e.clientY;

        // total drag delta from start
        const totalDy = e.clientY - startY;            // +ve when dragging down
        const rawHeight = startHeight - totalDy;       // raw height (unclamped) based on drag

        // allow some overdrag below min but dampen (rubberband)
        let dampenedHeight;
        if (rawHeight >= minHeight) {
          dampenedHeight = Math.min(rawHeight, maxHeight);
        } else {
          // user pulled below minHeight — allow visual movement but dampened
          const over = minHeight - rawHeight; // how many px beyond min
          const damp = minHeight - Math.min(MAX_OVERDRAG, over) * 0.35; // dampening factor
          dampenedHeight = Math.max(minHeight - MAX_OVERDRAG, damp);
        }

        // schedule DOM write with RAF for smoothness
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          container.style.height = `${Math.round(dampenedHeight)}px`;
          rafId = null;
        });
      }

      function pointerUp(e) {
        if (!isDragging) return;
        isDragging = false;

        try { dragHandle.releasePointerCapture && dragHandle.releasePointerCapture(e.pointerId); } catch (err) {}

        document.body.style.userSelect = '';
        document.body.style.touchAction = '';

        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }

        // compute final "raw" height from start (not dampened)
        const finalRawHeight = startHeight - (e.clientY - startY);

        // Decision to close:
        // 1) raw height pulled significantly below min (user clearly dragged past min)
        // 2) or user flicked downward fast (velocity threshold)
        // 3) or user dragged down more than ~45% of start height
        const draggedDownAmount = startHeight - finalRawHeight;
        const draggedDownFraction = draggedDownAmount / Math.max(1, startHeight);
        const shouldClose =
          finalRawHeight < (minHeight - CLOSE_RAW_PX) ||
          lastVelocity > CLOSE_VELOCITY ||
          draggedDownFraction > 0.45;

        if (shouldClose) {
          // animate slide-out by toggling classes (same as close button)
          container.classList.remove('revo-open');
          container.classList.add('revo-closing');
          container.addEventListener('transitionend', () => container.remove(), { once: true });
          return;
        }

        // Not closing — snap to the nearest snap point (in pixels)
        const snapsPx = SNAP_POINTS.map(p => Math.round(window.innerHeight * p));
        // find closest snap
        let closest = snapsPx[0];
        let minDiff = Math.abs((container.getBoundingClientRect().height || startHeight) - snapsPx[0]);
        for (let i = 1; i < snapsPx.length; i++) {
          const diff = Math.abs((container.getBoundingClientRect().height || startHeight) - snapsPx[i]);
          if (diff < minDiff) { minDiff = diff; closest = snapsPx[i]; }
        }

        // animate to snap height
        // set height with CSS transition (content.css has height transition)
        container.style.height = `${closest}px`;
      }

      // attach pointer events (remove older mouse handlers if present)
      dragHandle.addEventListener('pointerdown', pointerDown);
      window.addEventListener('pointermove', pointerMove);
      window.addEventListener('pointerup', pointerUp);
      window.addEventListener('pointercancel', pointerUp);


      const iframe = document.createElement("iframe");
      const repoInfo = getRepoInfo();
      if (repoInfo) {
        iframe.src = chrome.runtime.getURL("index.html") + `?owner=${repoInfo.owner}&repo=${repoInfo.repo}`;
      }
      container.appendChild(iframe);
    });

    // --- Add button after Watch
    const watchLi = actionsBar.querySelector("li");
    if (watchLi) actionsBar.insertBefore(revoLi, watchLi.nextSibling);
    else actionsBar.appendChild(revoLi);

    revoLi.appendChild(revoBtn);
    console.log("✅ REVO button added to Repo page");
  }

// --- Add REVO button on Pull Request page
  function addPRButton() {
    const headerActions = document.querySelector(".gh-header-actions");
    if (!headerActions) return;
    if (document.getElementById("revo-pr-button")) return; // avoid duplicates

    const btn = document.createElement("button");
    btn.id = "revo-pr-button";
    btn.className = "revo-pr-button";
    btn.innerText = "Run REVO";
    btn.addEventListener("click", () => {
      alert("REVO is ready to analyze this PR!");
    });

    headerActions.prepend(btn);
    console.log("✅ REVO button added to PR page");
  }

  // ========================
  // 3️⃣ DOM OBSERVER
  // ========================
  function startDomObserver() {
    if (domObserver) return; // already active

    domObserver = new MutationObserver(() => {
      if (/\/pull\/\d+/.test(location.pathname)) {
        addPRButton(); // PR page changes
      } else if (/^\/[^/]+\/[^/]+$/.test(location.pathname)) {
        addRepoButton(); // Repo homepage
      }
    });

    domObserver.observe(document.body, { childList: true, subtree: true });
    console.log("📸 DOM observer started");
  }

  function stopDomObserver() {
    if (domObserver) {
      domObserver.disconnect();
      domObserver = null;
      console.log("🛑 DOM observer stopped");
    }
  }

  // ========================
  // 4️⃣ URL WATCHER (GLOBAL)
  // ========================
  function onUrlChange() {
    if (location.href === lastUrl) return; // no change
    lastUrl = location.href;
    console.log("🔄 URL changed:", location.href);

    // Clean existing observers/buttons before switching context
    stopDomObserver();

    if (/\/pull\/\d+/.test(location.pathname)) {
      startDomObserver();
      addPRButton(); // Try immediately
    } else if (/^\/[^/]+\/[^/]+$/.test(location.pathname)) {
      startDomObserver();
      addRepoButton(); // Try immediately
    }
  }

  // Always watch for in-page URL changes (SPA behavior)
  const urlObserver = new MutationObserver(onUrlChange);
  urlObserver.observe(document.body, { childList: true, subtree: true });

  // ========================
  // 5️⃣ INITIALIZATION
  // ========================
  lastUrl = ""; 
  onUrlChange(); // run once on load
})();