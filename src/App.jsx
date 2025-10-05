import { useEffect, useState } from "react";

function App() {
  const [repoInfo, setRepoInfo] = useState(null);
  const [summary, setSummary] = useState("Fetching data...");
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const owner = params.get("owner");
    const repo = params.get("repo");
    if (owner && repo) setRepoInfo({ owner, repo });
  }, []);

  useEffect(() => {
    if (!repoInfo) return;

    async function fetchRepoData() {
      setSummary("Analyzing repository...");
      try {
        // 1️⃣ Fetch repo metadata
        const metaRes = await fetch(
          `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}`
        );
        const metaData = await metaRes.json();
        const defaultBranch = metaData.default_branch || "main";

        // 2️⃣ Fetch file tree
        const treeRes = await fetch(
          `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/git/trees/${defaultBranch}?recursive=1`
        );
        const treeData = await treeRes.json();

        if (!treeData.tree) {
          setSummary("⚠️ Could not retrieve repo tree.");
          return;
        }

        const allFiles = treeData.tree
          .filter((f) => f.type === "blob")
          .map((f) => f.path);

        // 3️⃣ Detect project type
        const has = (pattern) => allFiles.some((f) => f.includes(pattern));
        const projectType = has("package.json")
          ? "Node / JS"
          : has("requirements.txt") || has("setup.py")
          ? "Python"
          : has("pom.xml") || has("build.gradle")
          ? "Java / Kotlin"
          : has("Cargo.toml")
          ? "Rust"
          : has("go.mod")
          ? "Go"
          : has("composer.json")
          ? "PHP"
          : has("Gemfile")
          ? "Ruby"
          : "Generic";

        // 4️⃣ Define weighted importance map
        const weights = [
          { pattern: "README", score: 10 },
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
          { pattern: "Dockerfile", score: 5 },
          { pattern: ".github/workflows", score: 4 },
          { pattern: "tests/", score: 4 },
          { pattern: "docs/", score: 3 },
          { pattern: ".env.example", score: 3 },
          { pattern: "Makefile", score: 3 },
          { pattern: "LICENSE", score: 2 },
        ];

        // Scoring function
        function scoreFile(path) {
          if (
            /\.(png|jpg|jpeg|gif|svg|ico|map|lock|zip|pdf|mp4)$/i.test(path)
          )
            return -999; // skip junk
          let score = 0;
          for (const w of weights) {
            if (path.toLowerCase().includes(w.pattern.toLowerCase()))
              score += w.score;
          }
          return score;
        }

        // Rank by score
        const ranked = allFiles
          .map((path) => ({ path, score: scoreFile(path) }))
          .filter((f) => f.score > 0)
          .sort((a, b) => b.score - a.score);

        // Always include top-level important configs if missed
        const topLevel = allFiles.filter((p) => !p.includes("/")).slice(0, 5);

        // Final file selection (limit 15)
        const finalFiles = [...new Set([...ranked.map(f => f.path), ...topLevel])]
          .slice(0, 15);

        setSummary(
          `📦 Found ${allFiles.length} files. Selecting ${finalFiles.length} for detailed analysis...`
        );

        // 5️⃣ Fetch file contents (limited)
        const sampleContents = [];
        for (const path of finalFiles) {
          try {
            const rawURL = `https://raw.githubusercontent.com/${repoInfo.owner}/${repoInfo.repo}/${defaultBranch}/${path}`;
            const res = await fetch(rawURL);
            if (res.ok) {
              const text = await res.text();
              sampleContents.push({
                path,
                snippet: text.slice(0, 3000), // limit snippet size
              });
            }
          } catch (err) {
            console.warn("Error fetching", path, err);
          }
        }

        // 6️⃣ Prepare AI payload
        const payloadData = {
          repo: `${repoInfo.owner}/${repoInfo.repo}`,
          detectedType: projectType,
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

        setPayload(payloadData);

        // 7️⃣ Display summary
        const previewText = `
📦 **Repository:** ${payloadData.repo}
🧠 Detected type: ${payloadData.detectedType}
⭐ Stars: ${payloadData.metadata.stars} | 🍴 Forks: ${payloadData.metadata.forks}
🗂️ Files analyzed: ${payloadData.filesAnalyzed}
Language: ${payloadData.metadata.language}
Branch: ${payloadData.metadata.branch}

🔍 **Files Selected:**
${sampleContents.map((f) => "• " + f.path).join("\n")}

✅ Ready for AI Handoff
`;
        setSummary(previewText);
      } catch (err) {
        console.error(err);
        setSummary("⚠️ Error analyzing repository.");
      }
    }

    fetchRepoData();
  }, [repoInfo]);

  return (
    <div className="h-full flex flex-col font-sans text-sm bg-[var(--color-canvas-default)] text-[var(--color-fg-default)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--color-border-default)] bg-[var(--color-canvas-subtle)]">
        <h1 className="text-base font-semibold">
          {repoInfo
            ? `REVO Analysis – ${repoInfo.owner}/${repoInfo.repo}`
            : "No repository detected"}
        </h1>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="max-w-3xl px-3 py-3 rounded-md border bg-[var(--color-canvas-inset)] border-[var(--color-border-default)] whitespace-pre-wrap leading-relaxed">
          {summary}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[var(--color-border-default)] bg-[var(--color-canvas-subtle)]">
        <input
          type="text"
          placeholder="Ask REVO about this repo... (coming soon)"
          disabled
          className="w-full px-3 py-2 rounded-md text-sm border border-[var(--color-border-muted)] bg-[var(--color-canvas-inset)] text-[var(--color-fg-muted)]"
        />
      </div>
    </div>
  );
}

export default App;
