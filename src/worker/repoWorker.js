/* src/worker/repoWorker.js
   Web Worker: performs GitHub repo analysis off the main thread
*/

self.onmessage = async (evt) => {
  const data = evt.data || {};
  const owner = data.owner;
  const repo = data.repo;
  const token = data.token || null;
  const sampleLimit = Number(data.sampleLimit || 15);
  const maxSnippetLength = Number(data.maxSnippetLength || 1000);
  const concurrency = Number(data.concurrency || 4);

  if (!owner || !repo) {
    self.postMessage({ type: "error", message: "Missing owner or repo" });
    return;
  }

  const headers = { Accept: "application/vnd.github.v3+json" };
  if (token) headers.Authorization = `token ${token}`;

  try {
    // Fetch repo metadata
    const metaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers,
    });
    if (!metaRes.ok) throw new Error(`GitHub metadata fetch failed (${metaRes.status})`);
    const meta = await metaRes.json();
    const defaultBranch = meta.default_branch || "main";

    // Try tree via branch, else fallback to commit -> tree sha
    let treeData = null;
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`;
      const r = await fetch(url, { headers });
      if (r.ok) treeData = await r.json();
    } catch (e) {
      /* continue to fallback */
    }

    if (!treeData || !treeData.tree) {
      const commitRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/commits/${defaultBranch}`,
        { headers }
      );
      if (commitRes.ok) {
        const commitData = await commitRes.json();
        const treeSha = commitData?.commit?.tree?.sha || commitData?.commit?.tree;
        if (treeSha) {
          const treeRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`,
            { headers }
          );
          if (treeRes.ok) treeData = await treeRes.json();
        }
      }
    }

    if (!treeData || !treeData.tree) {
      throw new Error("Could not retrieve repo tree.");
    }

    // list of blobs
    const allFiles = treeData.tree.filter((f) => f.type === "blob").map((f) => f.path);

    // scoring weights (same idea as in main code)
    const weights = [
      { pattern: "readme", score: 10 },
      { pattern: "package.json", score: 10 },
      { pattern: "requirements.txt", score: 10 },
      { pattern: "setup.py", score: 10 },
      { pattern: "pyproject.toml", score: 10 },
      { pattern: "main.", score: 9 },
      { pattern: "index.", score: 9 },
      { pattern: "app.", score: 9 },
      { pattern: "src/", score: 7 },
      { pattern: "lib/", score: 7 },
      { pattern: "core/", score: 7 },
      { pattern: "backend/", score: 6 },
      { pattern: "components/", score: 6 },
      { pattern: "dockerfile", score: 5 },
      { pattern: ".github/workflows", score: 4 },
      { pattern: "tests/", score: 4 },
      { pattern: "docs/", score: 3 },
      { pattern: ".env.example", score: 3 },
      { pattern: "makefile", score: 3 },
      { pattern: "license", score: 2 },
    ];

    function scoreFile(path) {
      if (/\.(png|jpg|jpeg|gif|svg|ico|map|lock|zip|pdf|mp4|exe|dll)$/i.test(path)) return -999;
      const l = path.toLowerCase();
      let s = 0;
      for (const w of weights) {
        if (l.includes(w.pattern)) s += w.score;
      }
      return s;
    }

    const ranked = allFiles
      .map((p) => ({ path: p, score: scoreFile(p) }))
      .filter((f) => f.score > 0)
      .sort((a, b) => b.score - a.score);

    const topLevel = allFiles.filter((p) => !p.includes("/")).slice(0, 5);
    const finalFiles = Array.from(new Set([...ranked.map((f) => f.path), ...topLevel])).slice(
      0,
      sampleLimit
    );

    // redact function
    function redactSecrets(text = "") {
      return text.replace(
        /(api[_-]?key|apikey|secret|password|token)\s*[:=]\s*([^\s'";,#]+)/gi,
        "$1: [REDACTED]"
      );
    }

    // fetch files with concurrency
    async function fetchWithConcurrency(paths, limit) {
      const results = new Array(paths.length).fill(null);
      let cursor = 0;

      async function worker() {
        while (true) {
          const idx = cursor++;
          if (idx >= paths.length) return;
          const path = paths[idx];
          try {
            const raw = `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${path}`;
            const r = await fetch(raw);
            if (!r.ok) {
              results[idx] = null;
              continue;
            }
            let text = await r.text();
            text = redactSecrets(text).slice(0, maxSnippetLength);
            results[idx] = { path, snippet: text };
          } catch (err) {
            results[idx] = null;
          }
        }
      }

      const workers = new Array(Math.min(limit, paths.length)).fill(0).map(worker);
      await Promise.all(workers);
      return results.filter(Boolean);
    }

    const sampleContents = await fetchWithConcurrency(finalFiles, concurrency);

    const payload = {
      repo: `${owner}/${repo}`,
      metadata: meta,
      samples: sampleContents,
      filesAnalyzed: sampleContents.length,
    };

    const preview = [
      `📦 Repository: ${payload.repo}`,
      `🧠 Type: ${meta.language || "—"}`,
      `⭐ Stars: ${meta.stargazers_count || 0} | 🍴 Forks: ${meta.forks_count || 0}`,
      `🗂️ Files analyzed: ${payload.filesAnalyzed}`,
      `Branch: ${defaultBranch}`,
      "",
      "✅ Ready for AI Handoff",
    ].join("\n");

    self.postMessage({ type: "result", payload, preview });
  } catch (err) {
    const msg = err?.message || String(err);
    self.postMessage({ type: "error", message: msg });
  }
};
