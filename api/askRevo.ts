// api/askRevo.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { summary, samples, question } = req.body;
    if (!question || (!summary && !samples)) {
      return res.status(400).json({ error: "Missing question or context." });
    }

    const context = `
You are REVO, a professional GitHub repo analyst.
Answer questions using the provided summary and file snippets as your only context.

## Repository Summary
${summary}

## Selected Files
${samples?.map((f: any) => `### ${f.path}\n${f.snippet?.slice(0, 600)}`).join("\n") || "No files"}
`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.3,
      max_tokens: 600,
      messages: [
        { role: "system", content: "You are REVO, an expert code explainer and architecture analyst." },
        { role: "user", content: context },
        { role: "user", content: `User question: ${question}` },
      ],
    });

    res.status(200).json({
      answer: completion.choices?.[0]?.message?.content || "No answer generated.",
    });
  } catch (err: any) {
    console.error("Ask REVO error:", err);
    res.status(500).json({ error: err.message || "Internal error" });
  }
}
