console.log("REVO content script loaded!");

window.addEventListener("load", () => {
  // 1. Find the repo actions container <ul>
  const actionsBar = document.querySelector("ul.pagehead-actions");
  if (!actionsBar) {
    console.log("Could not find actions bar");
    return;
  }

  // 2. Create a <li> wrapper
  const revoLi = document.createElement("li");

  // 3. Create REVO button (GitHub-style, styled by content.css if needed)
  const revoBtn = document.createElement("button");
  revoBtn.innerText = "REVO";
  revoBtn.className = "btn btn-sm btn-with-count"; // GitHub’s style
  revoBtn.style.marginLeft = "8px";

revoBtn.addEventListener("click", () => {
  console.log("REVO button clicked!");

  const existing = document.getElementById("revo-overlay");
  if (existing) {
    console.log("Closing existing overlay...");
    existing.classList.remove("revo-open");
    existing.classList.add("revo-closing");
    existing.addEventListener("transitionend", () => existing.remove(), { once: true });
    return; // closes instead of skipping
  }

  // --- Overlay creation ---
  const container = document.createElement("div");
  container.id = "revo-overlay";
  document.body.appendChild(container);

  // Animate open (CSS handles translateY)
  requestAnimationFrame(() => {
    container.classList.add("revo-open");
  });

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
  iframe.src = chrome.runtime.getURL("index.html");
  container.appendChild(iframe);
});

  // 5. Insert button into <li>
  revoLi.appendChild(revoBtn);

  // 6. Add it to the actions bar after Watch
  const watchLi = actionsBar.querySelector("li");
  if (watchLi) {
    actionsBar.insertBefore(revoLi, watchLi.nextSibling);
  } else {
    actionsBar.appendChild(revoLi);
  }
});
