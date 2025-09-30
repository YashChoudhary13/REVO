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

  // 3. Create REVO button
  const revoBtn = document.createElement("button");
  revoBtn.innerText = "REVO";
  revoBtn.className = "btn btn-sm btn-with-count"; // matches Watch/Fork/Star
  revoBtn.style.marginLeft = "8px";

  // 4. Add click handler → inject overlay here
  revoBtn.addEventListener("click", () => {
    console.log("REVO button clicked!");

    // ✅ Prevent multiple overlays
    if (document.getElementById("revo-overlay")) {
        console.log("Overlay already open, skipping...");
        return;
    }
    // --- Overlay code starts here ---
    const container = document.createElement("div");
    container.id = "revo-overlay";
    document.body.appendChild(container);

    container.style.position = "fixed";
    container.style.bottom = "0";
    container.style.left = "0";
    container.style.width = "100%";
    container.style.height = "75%";
    container.style.background = "white";
    container.style.boxShadow = "0 -2px 10px rgba(0,0,0,0.2)";
    container.style.zIndex = "999999";
    container.style.display = "flex";
    container.style.flexDirection = "column";

    // Top bar
    const topBar = document.createElement("div");
    topBar.style.background = "#24292e";
    topBar.style.color = "white";
    topBar.style.padding = "8px";
    topBar.style.display = "flex";
    topBar.style.justifyContent = "flex-end";

    // Close button
    const closeBtn = document.createElement("button");
    closeBtn.innerText = "✖ Close";
    closeBtn.style.background = "transparent";
    closeBtn.style.border = "none";
    closeBtn.style.color = "white";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.fontSize = "14px";
    closeBtn.addEventListener("click", () => container.remove());

    // Pop Out button
    const popOutBtn = document.createElement("button");
    popOutBtn.innerText = "↗ Pop Out";
    popOutBtn.style.background = "transparent";
    popOutBtn.style.border = "none";
    popOutBtn.style.color = "white";
    popOutBtn.style.cursor = "pointer";
    popOutBtn.style.fontSize = "14px";
    popOutBtn.style.marginRight = "10px";
    popOutBtn.addEventListener("click", () => {
      window.open(chrome.runtime.getURL("index.html"), "_blank");
      container.remove();
    });

    topBar.appendChild(popOutBtn);
    topBar.appendChild(closeBtn);
    container.appendChild(topBar);

    // React app iframe
    const iframe = document.createElement("iframe");
    iframe.src = chrome.runtime.getURL("index.html");
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";

    container.appendChild(iframe);
    // --- Overlay code ends here ---
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
