// src/App.jsx
import { useEffect, useState, useRef, useMemo, startTransition, Suspense, lazy } from "react";
const ReactMarkdown = lazy(() => import("react-markdown"));

/**
 * REVO — Overlay (worker-first, inline fallback)
 * - Uses a background worker when available to avoid UI jank
 * - Inline fallback runs during idle time and chunks downloads
 * - Persists lightweight cache in sessionStorage while tab is active
 * - Lazy-renders Markdown to keep popup responsive
 */

function App() {
  const [repoInfo, setRepoInfo] = useState(null);
  const [status, setStatus] = useState("Waiting for repository...");
  const [preview, setPreview] = useState("");
  const [payload, setPayload] = useState(null);
  const [aiSummary, setAiSummary] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [fetchingRepo, setFetchingRepo] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Try to restore lightweight cache (sessionStorage)
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem("revoData");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.repoInfo) setRepoInfo(parsed.repoInfo);
        if (parsed?.payload) setPayload(parsed.payload);
        if (parsed?.preview) setPreview(parsed.preview);
        if (parsed?.aiSummary) setAiSummary(parsed.aiSummary);
        if (parsed?.payload) setStatus("✅ Loaded previous session data");
      }
    } catch (e) {
      console.warn("Failed to load cached REVO data", e);
    }
  }, []);

  // persist safe, small cache whenever key state changes
  useEffect(() => {
    try {
      const lightPayload = payload
        ? {
            repo: payload.repo,
            metadata: payload.metadata,
            filesAnalyzed: payload.filesAnalyzed,
            // store only small snippet preview to avoid huge sessionStorage usage
            samples: (payload.samples || []).map((s) => ({ path: s.path, snippet: String(s.snippet || "").slice(0, 200) })),
          }
        : null;

      const cache = {
        repoInfo,
        payload: lightPayload,
        preview,
        aiSummary,
        ts: Date.now(),
      };
      sessionStorage.setItem("revoData", JSON.stringify(cache));
    } catch (e) {
      // ignore persistence errors
    }
  }, [repoInfo, payload, preview, aiSummary]);

  // mounted guard
  const isMounted = useRef(true);
  useEffect(() => () => (isMounted.current = false), []);

  // API base detection (env-aware)
  const isExtension = typeof chrome !== "undefined" && !!chrome.runtime?.id;
  const API_BASE =
    import.meta.env.VITE_API_BASE ||
    (isExtension ? "https://rev0.vercel.app" : import.meta.env.DEV ? "http://localhost:3000" : "https://rev0.vercel.app");

  // worker reference
  const workerRef = useRef(null);

  // init worker (if available)
  useEffect(() => {
    let worker;
    try {
      // Vite-friendly worker import
      worker = new Worker(new URL("./worker/repoWorker.js", import.meta.url), { type: "module" });
      console.log("🧠 REVO Worker initialized successfully");
      workerRef.current = worker;

      worker.onmessage = (ev) => {
        const d = ev.data || {};
        if (d.type === "result" && d.payload) {
          console.log("📩 Worker result received:", d.payload.filesAnalyzed ?? 0, "files");
          startTransition(() => {
            if (!isMounted.current) return;
            setPayload(d.payload);
            setPreview(d.preview || "");
            setStatus("✅ Repository ready for AI Handoff");
          });
          setFetchingRepo(false);
        } else if (d.type === "error") {
          setErrorMsg(d.message || "Worker analysis error");
          setStatus("⚠️ Repository fetch failed.");
          setFetchingRepo(false);
        }
      };

      worker.onerror = (err) => {
        console.error("Repo worker error:", err);
        setErrorMsg("Repository worker failed, falling back to inline processing");
        setStatus("⚠️ Repository worker failed.");
        setFetchingRepo(false);
      };
    } catch (err) {
      console.warn("Worker initialization failed, will run inline:", err);
      workerRef.current = null;
    }

    return () => {
      if (workerRef.current) {
        try {
          workerRef.current.terminate();
        } catch {}
        workerRef.current = null;
      }
      if (worker) {
        try {
          worker.terminate();
        } catch {}
      }
    };
  }, []);

  // parse repo params from overlay URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const owner = params.get("owner");
    const repo = params.get("repo");
    if (owner && repo) {
      // keep repoInfo small and deterministic; add '_nonce' on manual re-runs
      setRepoInfo((prev) => (prev && prev.owner === owner && prev.repo === repo ? { owner, repo, _nonce: Date.now() } : { owner, repo, _nonce: Date.now() }));
      setStatus("Repository detected — preparing analysis...");
    } else {
      setStatus("⚠️ No repository parameters found.");
    }
  }, []);

  // redact obvious secrets
  function redactSecrets(text = "") {
    return text.replace(/(api[_-]?key|apikey|secret|password|token)\s*[:=]\s*([^\s'";,#]+)/gi, "$1: [REDACTED]");
  }

  // idle helper (fallback to setTimeout if requestIdleCallback absent)
  const idleRun = (fn) => (window.requestIdleCallback ? window.requestIdleCallback(fn) : setTimeout(fn, 60));

  // fetch & analyze repository (worker-first, inline fallback)
  useEffect(() => {
    if (!repoInfo) return;
    const controller = new AbortController();
    const signal = controller.signal;

    async function fetchRepoDataInline() {
      setFetchingRepo(true);
      setErrorMsg("");
      setAiSummary("");
      setPayload(null);
      setPreview("");
      setStatus("Analyzing repository (inline fallback)...");

      try {
        const { owner, repo } = repoInfo;
        const headers = { Accept: "application/vnd.github.v3+json" };
        const GITHUB_TOKEN = import.meta.env.VITE_GITHUB_TOKEN;
        if (GITHUB_TOKEN) headers.Authorization = `token ${GITHUB_TOKEN}`;

        // metadata
        const metaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers, signal });
        if (!metaRes.ok) throw new Error(`GitHub metadata fetch failed (${metaRes.status})`);
        const metaData = await metaRes.json();
        const defaultBranch = metaData.default_branch || "main";

        // try tree or fallback commit-tree sha
        let treeData = null;
        try {
          const tryUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`;
          const treeRes = await fetch(tryUrl, { headers, signal });
          if (treeRes.ok) treeData = await treeRes.json();
        } catch (e) {}

        if (!treeData || !treeData.tree) {
          const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${defaultBranch}`, { headers, signal });
          if (commitRes.ok) {
            const commitData = await commitRes.json();
            const treeSha = commitData?.commit?.tree?.sha || commitData?.commit?.tree;
            if (treeSha) {
              const treeRes2 = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`, { headers, signal });
              if (treeRes2.ok) treeData = await treeRes2.json();
            }
          }
        }

        if (!treeData || !treeData.tree) throw new Error("Could not retrieve repository tree.");

        const allFiles = treeData.tree.filter((f) => f.type === "blob").map((f) => f.path || "");
        const weights = [
          { pattern: "readme", score: 10 },
          { pattern: "package.json", score: 10 },
          { pattern: "requirements.txt", score: 10 },
          { pattern: "pyproject.toml", score: 8 },
          { pattern: "main.", score: 9 },
          { pattern: "src/", score: 9 },
          { pattern: "index.", score: 8 },
          { pattern: "app.", score: 8 },
          { pattern: "lib/", score: 6 },
          { pattern: "core/", score: 5 },
          { pattern: "components/", score: 5 },
          { pattern: "dockerfile", score: 4 },
          { pattern: ".github/workflows", score: 3 },
          { pattern: "tests/", score: 3 },
          { pattern: "docs/", score: 2 },
        ];

        function scoreFile(path) {
          if (/\.(png|jpg|jpeg|gif|svg|ico|map|lock|zip|pdf|mp4|exe|dll)$/i.test(path)) return -999;
          const l = (path || "").toLowerCase();
          return weights.reduce((acc, w) => (l.includes(w.pattern) ? acc + w.score : acc), 0);
        }

        const ranked = allFiles.map((p) => ({ path: p, score: scoreFile(p) })).filter((f) => f.score > 0).sort((a, b) => b.score - a.score);
        let finalFiles = ranked.slice(0, 15).map((f) => f.path);
        if (!finalFiles.length) finalFiles = allFiles.filter((p) => /\.(js|ts|py|java|go|md|json|yaml|yml)$/i.test(p)).slice(0, 15);

        setStatus(`📦 Found ${allFiles.length} files. Selecting ${finalFiles.length}...`);

        // chunked fetch to avoid blocking UI
        const CONCURRENCY = 4;
        const chunks = [];
        for (let i = 0; i < finalFiles.length; i += CONCURRENCY) chunks.push(finalFiles.slice(i, i + CONCURRENCY));

        let sampleContents = [];
        for (const chunk of chunks) {
          const results = await Promise.all(
            chunk.map(async (path) => {
              try {
                if (/(^|\/)\.(env|env.local|secrets|credentials)/i.test(path)) {
                  return { path, snippet: "[REDACTED - sensitive file]" };
                }
                const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${path}`;
                const r = await fetch(rawUrl, { signal });
                if (!r.ok) return null;
                const text = await r.text();
                return { path, snippet: redactSecrets(text).slice(0, 1000) };
              } catch (err) {
                return null;
              }
            })
          );
          sampleContents = sampleContents.concat(results.filter(Boolean));
          // yield to event loop so popup stays responsive
          await new Promise((resolve) => setTimeout(resolve, 25));
        }

        const payloadData = {
          repo: `${owner}/${repo}`,
          detectedType: "Detected",
          metadata: {
            name: metaData.full_name,
            description: metaData.description,
            stars: metaData.stargazers_count,
            forks: metaData.forks_count,
            language: metaData.language,
            branch: defaultBranch,
          },
          filesAnalyzed: sampleContents.length,
          samples: sampleContents,
        };

        if (isMounted.current) {
          startTransition(() => {
            setPayload(payloadData);
            setPreview(
              [
                `📦 ${payloadData.repo}`,
                `🧠 Type: ${payloadData.detectedType}`,
                `⭐ Stars: ${payloadData.metadata.stars} | 🍴 Forks: ${payloadData.metadata.forks}`,
                `🗂️ Files analyzed: ${payloadData.filesAnalyzed}`,
                `Language: ${payloadData.metadata.language}`,
                `Branch: ${payloadData.metadata.branch}`,
                "",
                "✅ Ready for AI Handoff",
              ].join("\n")
            );
            setStatus("✅ Repository ready for AI analysis.");
          });
        }
      } catch (err) {
        console.error("Repo fetch error (inline):", err);
        if (isMounted.current) {
          setStatus("⚠️ Repository fetch failed (inline).");
          setErrorMsg(err?.message || "Repository analysis failed. Check logs.");
        }
      } finally {
        if (isMounted.current) setFetchingRepo(false);
      }
    }

    // send to worker if available otherwise idle-run inline
    if (workerRef.current) {
      setFetchingRepo(true);
      setErrorMsg("");
      setAiSummary("");
      setPayload(null);
      setPreview("");
      setStatus("Analyzing repository (background worker)...");
      try {
        workerRef.current.postMessage({
          owner: repoInfo.owner,
          repo: repoInfo.repo,
          token: import.meta.env.VITE_GITHUB_TOKEN || null,
          sampleLimit: 15,
          maxSnippetLength: 1000,
          concurrency: 4,
        });
      } catch (err) {
        console.warn("Worker postMessage failed, falling back to inline:", err);
        idleRun(() => fetchRepoDataInline());
      }
    } else {
      idleRun(() => {
        fetchRepoDataInline().catch((e) => console.error("fetchRepoDataInline error:", e));
      });
    }

    return () => {
      try {
        controller.abort();
      } catch {}
    };
  }, [repoInfo]);

  // reanalyze listener (other pieces of code can dispatch a revo:reanalyze event)
  useEffect(() => {
    const handler = (e) => {
      const info = e?.detail;
      if (info && info.owner && info.repo) {
        // create new object (different identity) to retrigger effect
        setRepoInfo({ owner: info.owner, repo: info.repo, _nonce: Date.now() });
        setStatus("Re-analysis requested...");
      }
    };
    window.addEventListener("revo:reanalyze", handler);
    return () => window.removeEventListener("revo:reanalyze", handler);
  }, []);

  // AI handoff
  async function handleAIHandoff() {
    if (!payload) {
      alert("Payload not ready yet!");
      return;
    }

    setLoadingAI(true);
    setStatus("Analyzing with REVO AI...");
    setErrorMsg("");
    setAiSummary("");

    try {
      const res = await fetch(`${API_BASE}/api/analyzeRepo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoSummary: preview || `Repository: ${payload.repo}`,
          selectedFiles: payload.samples || [],
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`AI endpoint failed (${res.status}): ${txt}`);
      }

      const data = await res.json();
      const summaryText = data.summary || "⚠️ No summary returned from AI.";
      startTransition(() => {
        if (!isMounted.current) return;
        setAiSummary(`${summaryText}\n\n---\n⚡ Generated in ${data.latency || "?"}s · ${data.tokens || "?"} tokens · Model: ${data.model || "unknown"}`);
        setStatus("✅ AI analysis complete.");
      });
    } catch (err) {
      console.error("AI Handoff Error:", err);
      setErrorMsg(String(err?.message || err));
      setAiSummary(`⚠️ AI analysis failed.\n\n${String(err?.message || err)}`);
      setStatus("❌ AI analysis failed.");
    } finally {
      setLoadingAI(false);
    }
  }

  // Ask-REVO feature
  async function handleAskRevo(question) {
    if (!payload) return alert("Analyze a repo first!");
    setLoadingAI(true);
    setStatus("💬 Asking REVO...");
    try {
      const res = await fetch(`${API_BASE}/api/askRevo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: aiSummary,
          samples: payload.samples,
          question,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ask REVO failed");
      setAiSummary((prev) => `${prev}\n\n**Q:** ${question}\n**A:** ${data.answer}`);
      setStatus("✅ REVO answered your question.");
    } catch (err) {
      console.error(err);
      setStatus("⚠️ Ask REVO failed.");
    } finally {
      setLoadingAI(false);
    }
  }

  const markdown = useMemo(() => aiSummary, [aiSummary]);

  // UI — reset now re-runs analysis (keeps cache until tab closed)
  const handleReset = () => {
    if (!repoInfo) {
      setStatus("No repository detected.");
      return;
    }
    // clear transient UI but keep repoInfo; mutate identity to retrigger effect
    setPreview("");
    setPayload(null);
    setAiSummary("");
    setErrorMsg("");
    setStatus("Re-analyzing repository...");
    setFetchingRepo(true);
    setRepoInfo({ owner: repoInfo.owner, repo: repoInfo.repo, _nonce: Date.now() });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0D1117] text-gray-100 font-inter text-[15px]">
      {/* Header */}
      <header className="px-6 py-3 border-b border-[#30363D] bg-[#0D1117]/95 backdrop-blur-md flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-base">
            {repoInfo ? `REVO • ${repoInfo.owner}/${repoInfo.repo}` : "REVO"}
          </h1>
          <p className="text-xs text-gray-400">{status}</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="px-3 py-1 text-xs border border-[#30363D] rounded-md hover:bg-[#21262D] transition"
          >
            Reset
          </button>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
        {/* Preview card (full-width friendly) */}
        {preview && (
          <div className="w-full rounded-xl border border-[#1F2937] bg-[#161B22]/80 p-4 backdrop-blur-sm">
            <pre className="whitespace-pre-wrap text-gray-300 leading-relaxed m-0">{preview}</pre>
          </div>
        )}

        {/* Action */}
        <div className="flex justify-center">
          <button
            onClick={handleAIHandoff}
            disabled={!payload || loadingAI || fetchingRepo}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
              loadingAI ? "bg-gray-600 cursor-not-allowed" : "bg-[#238636] hover:bg-[#2ea043]"
            } text-white`}
          >
            {loadingAI ? "Generating..." : "🤖 Generate AI Summary"}
          </button>
        </div>

        {/* Errors */}
        {errorMsg && <p className="text-center text-red-400 text-sm">{errorMsg}</p>}

        {/* AI result */}
        {markdown && (
          <Suspense fallback={<div className="text-gray-400 text-center">🌀 Rendering summary...</div>}>
            <div className="w-full rounded-xl border border-[#1F2937] bg-[#161B22]/80 p-6 animate-fade-in leading-loose tracking-wide will-change-transform">
              <h2 className="font-semibold text-lg mb-3 text-white">REVO AI Summary</h2>
              <ReactMarkdown
                className="prose prose-invert prose-base max-w-none"
                components={{
                  p: ({ children }) => <p className="text-gray-300 mb-4 leading-relaxed">{children}</p>,
                  li: ({ children }) => <li className="text-gray-300 leading-relaxed">{children}</li>,
                  strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                  code: ({ children }) => <code className="px-1.5 py-0.5 rounded bg-[#0B1220] text-[#58A6FF] font-mono text-xs">{children}</code>,
                }}
              >
                {markdown}
              </ReactMarkdown>
            </div>
          </Suspense>
        )}
      </main>

      {/* Footer (sticky, Ask REVO) */}
      <footer className="sticky bottom-0 px-6 py-3 border-t border-[#30363D] bg-[#0D1117]/95 backdrop-blur-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const question = e.target.elements.query.value.trim();
            if (!question) return;
            handleAskRevo(question);
            e.target.reset();
          }}
          className="flex gap-2"
        >
          <input
            name="query"
            type="text"
            placeholder="Ask REVO about this repo..."
            className="flex-1 px-3 py-2 rounded-md bg-[#161B22] border border-[#30363D] text-gray-100 placeholder-gray-500"
            disabled={!payload}
          />
          <button
            type="submit"
            disabled={loadingAI || !payload}
            className="px-3 py-2 text-sm font-medium bg-[#238636] hover:bg-[#2ea043] rounded-md text-white transition-all disabled:bg-gray-700"
          >
            Ask
          </button>
        </form>
      </footer>

      <style>{`
        .prose p, .prose li { line-height: 1.75 !important; letter-spacing: 0.01em; }
        @keyframes fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.6s ease-out forwards; }
      `}</style>
    </div>
  );
}

export default App;
