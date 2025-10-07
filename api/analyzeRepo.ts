/**
 * REVO AI – Repository Intelligence Endpoint (Groq-Powered)
 * ----------------------------------------------------------
 * Accepts structured repository data from the frontend, analyzes it via Groq LLM,
 * and returns a clean Markdown summary of the project.
 *
 * ✨ Features:
 * - Fully compatible with old + new REVO frontends
 * - Automatic fallback for repoSummary or repo/samples
 * - Runtime latency + token logging
 * - Defensive error handling for missing data or bad responses
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import dotenv from "dotenv";
import Groq from "groq-sdk";

dotenv.config({ path: ".env.local" });

// --- Groq Client Initialization ----------------------------------------------
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

// --- Type Definitions --------------------------------------------------------
interface RepoFile {
  path: string;
  content?: string;
  snippet?: string;
}

interface AnalyzeRepoRequest {
  repoSummary?: string;
  selectedFiles?: RepoFile[];
  repo?: string;
  samples?: RepoFile[];
}

// --- Main Handler ------------------------------------------------------------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ✅ CORS (for GitHub overlay & Chrome extension)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    // --- Step 1: Flexible input parsing --------------------------------------
    const body = req.body as AnalyzeRepoRequest;

    const repoSummary =
      body.repoSummary ||
      (body.repo ? `Repository: ${body.repo}` : "") ||
      "";

    const selectedFiles =
      body.selectedFiles?.length
        ? body.selectedFiles
        : body.samples?.length
        ? body.samples
        : [];

    if (!repoSummary && !selectedFiles.length) {
      return res.status(400).json({
        error:
          "Missing repository context — please provide repoSummary or selectedFiles.",
      });
    }

    // --- Step 2: Build expert prompt -----------------------------------------
    const formattedFiles =
      selectedFiles
        .map((f) => {
          const content = f.content || f.snippet || "No content provided.";
          return `\n### ${f.path}\n${content.slice(0, 800)}`;
        })
        .join("\n") || "No files were provided for analysis.";

    const prompt = `
You are **REVO**, an intelligent GitHub repository explainer and senior-level codebase analyst.
Examine the provided repository context and produce a concise, well-structured Markdown summary.

### 1. Overview
Describe the purpose of the repository, what it does, and its main architecture.

### 2. Components
Highlight important files, modules, or configurations and their roles.

### 3. Tech Stack
Identify key languages, frameworks, or tools used.

### 4. Insights (optional)
If relevant, provide one or two key implementation insights or potential improvements.

---

#### Repository Summary
${repoSummary || "No high-level summary provided."}

#### Sample Files
${formattedFiles}
`;

    // --- Step 3: LLM Execution ----------------------------------------------
    const start = Date.now();

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.4,
      max_tokens: 850,
      messages: [
        {
          role: "system",
          content:
            "You are REVO — a professional software architecture analyst. Always return clear, Markdown-formatted summaries.",
        },
        { role: "user", content: prompt },
      ],
    });

    const end = Date.now();
    const latency = ((end - start) / 1000).toFixed(2);

    const usage: Record<string, number> = (completion as any).usage || {};
    const totalTokens =
      usage.total_tokens ||
      usage.completion_tokens ||
      usage.prompt_tokens ||
      0;

    const aiSummary =
      completion.choices?.[0]?.message?.content?.trim() ||
      "⚠️ No AI summary generated.";

    // --- Step 4: Structured Logging ------------------------------------------
    console.log(
      `✅ [REVO AI] Completed in ${latency}s | Tokens: ${totalTokens} | Model: llama-3.1-8b-instant`
    );

    // --- Step 5: Respond cleanly ---------------------------------------------
    res.status(200).json({
      summary: aiSummary,
      latency,
      tokens: totalTokens,
      model: "llama-3.1-8b-instant",
    });
  } catch (error: any) {
    // --- Step 6: Robust Error Handling ---------------------------------------
    console.error("❌ REVO AI Handoff Error:", error);

    const errorMsg =
      error.response?.data?.error?.message ||
      error.message ||
      "Unknown internal error.";

    res.status(500).json({
      error: `AI service failure: ${errorMsg}`,
      hint:
        "Ensure your GROQ_API_KEY is valid and the model is available. Check console logs for details.",
    });
  }
}
