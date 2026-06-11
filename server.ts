/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { chunkText, generateEmbedding, calculateCosineSimilarity, getMockRagResponse } from "./src/ragEngine";
import { RagChunk, RagResult } from "./src/types";

// Load environment variables from .env
dotenv.config();

// Initialize the Express app globally so it can be exported and imported by Vercel
const app = express();
export { app };

// Middleware for parsing JSON requests
app.use(express.json());

// Lazy-initialize Gemini SDK to protect against crashes if key is omitted or missing.
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    let apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      apiKey = apiKey.trim().replace(/^["']|["']$/g, ""); // Remove quotes defensively
    }
    if (apiKey && apiKey !== "MY_GEMINI_API_KEY" && apiKey.trim() !== "") {
      aiClient = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }
  }
  return aiClient;
}

// Helper to compute keyword overlap score as a fallback alignment metric
function calculateAlignmentScore(generated: string, expected: string): number {
  if (!expected.trim()) return 0;
  
  // Clean strings
  const cleanG = generated.toLowerCase().replace(/[^a-z0-9\s]/g, "");
  const cleanE = expected.toLowerCase().replace(/[^a-z0-9\s]/g, "");
  
  const stopWords = new Set(["the", "a", "an", "is", "of", "and", "or", "to", "in", "with", "are", "on", "at", "by", "for", "from"]);
  
  const wordsG = cleanG.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
  const wordsE = cleanE.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
  
  if (wordsE.length === 0) return 100;
  
  // Find match count
  const setG = new Set(wordsG);
  let matches = 0;
  for (const we of wordsE) {
    if (setG.has(we)) {
      matches += 1;
    } else {
      // Check partial substring match
      for (const wg of wordsG) {
        if (wg.includes(we) || we.includes(wg)) {
          matches += 0.5;
          break;
        }
      }
    }
  }
  
  const score = Math.round((matches / wordsE.length) * 100);
  return Math.min(100, Math.max(0, score));
}

// Status check endpoint to inform the frontend system if a real Gemini key is active
app.get("/api/status", (req, res) => {
  const ai = getGeminiClient();
  let rawKey = process.env.GEMINI_API_KEY || "";
  rawKey = rawKey.trim().replace(/^["']|["']$/g, "");
  res.json({
    usingMockAI: !ai,
    hasApiKeyConfigured: !!(rawKey && rawKey !== "MY_GEMINI_API_KEY" && rawKey !== ""),
  });
});

// Grounded full-stack RAG pipeline execution
app.post("/api/rag/run", async (req, res) => {
  const startTime = Date.now();
  try {
    const {
      documentText = "",
      question = "",
      chunkSize = 180,
      chunkOverlap = 40,
      topK = 2,
      expectedAnswer = "",
    } = req.body;

    if (!documentText.trim()) {
      return res.status(400).json({ error: "Document text is required to run RAG." });
    }
    if (!question.trim()) {
      return res.status(400).json({ error: "A question is required to retrieve answers." });
    }

    // Step 1: Chunking the original document
    const rawChunks = chunkText(documentText, Number(chunkSize), Number(chunkOverlap));
    if (rawChunks.length === 0) {
      return res.status(400).json({ error: "Could not split the text into any chunks. Try increasing text length or reducing chunk size." });
    }

    // Step 2 & 3: Embedding Creation & Vector DB simulation
    const textChunks: RagChunk[] = rawChunks.map((chunk, idx) => {
      const vector = generateEmbedding(chunk.text);
      return {
        id: idx + 1,
        text: chunk.text,
        charStart: chunk.charStart,
        charEnd: chunk.charEnd,
        vector,
      };
    });

    // Step 4: Generating Embedding for Query
    const queryVector = generateEmbedding(question);

    // Step 5: Similarity Search via Cosine/Dot Product
    textChunks.forEach(chunk => {
      chunk.similarity = calculateCosineSimilarity(chunk.vector, queryVector);
    });

    // Step 6: Rank chunks by similarity descending
    const sortedChunks = [...textChunks].sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
    
    // Step 7: Assign rank index and mark topK
    sortedChunks.forEach((chunk, index) => {
      chunk.rank = index + 1;
      chunk.selected = index < Number(topK);
    });

    // We re-sort back to ID order or keep the ranked list
    const finalChunks = textChunks.map(original => {
      const sortedMatch = sortedChunks.find(sc => sc.id === original.id)!;
      return {
        ...original,
        similarity: sortedMatch.similarity,
        rank: sortedMatch.rank,
        selected: sortedMatch.selected,
      };
    });

    const topKChunks = sortedChunks.filter(c => c.selected);

    // Step 8: Context Augmentation (Concatenate top chunks)
    const retrievedContext = topKChunks
      .map((c, i) => `[Source Chunk #${c.id} | Sim: ${Math.round((c.similarity || 0) * 100)}%]\n${c.text}`)
      .join("\n\n");

    // Set up standard educational system instructions
    const systemInstructionUsed = 
      "You are an educational AI assistant inside the Interactive RAG Learning Playground.\n" +
      "Your goal is to answer the user's question STRICTLY using only the retrieved text chunks provided in the Context window.\n" +
      "This answers the student's prompt and teaches them how LLMs avoid hallucinations in production settings.\n" +
      "CRITICAL RULES:\n" +
      "1. Answer using only the retrieved facts.\n" +
      "2. If the retrieved context does not contain enough information to formulate an answer, state: " +
      "'Based on the retrieved context, there is no sufficient information in the provided document to answer your question.' " +
      "(This beautifully demonstrates the RAG grounding out-of-domain fallback!).\n" +
      "3. Do not invent details or assume background knowledge not found in the source.";

    const fullPromptToLlm = 
      `CONCEPTS AND CONTEXT WINDOW SENT TO LLM:\n` +
      `--------------------------------------------------\n` +
      `CONTEXT:\n${retrievedContext || "[No relevant context retrieved]"}\n` +
      `--------------------------------------------------\n` +
      `QUESTION: ${question}\n` +
      `--------------------------------------------------\n` +
      `Begin your grounded answer:`;

    // Step 9: LLM Processing
    let answer = "";
    let usingMockAI = true;

    const ai = getGeminiClient();
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: fullPromptToLlm,
          config: {
            systemInstruction: systemInstructionUsed,
            temperature: 0.1, // Low temp for grounded answers
          }
        });
        if (response.text) {
          answer = response.text.trim();
          usingMockAI = false;
        } else {
          answer = getMockRagResponse(question, retrievedContext);
        }
      } catch (genError: any) {
        console.error("Gemini Generation Error, falling back to simulator logic:", genError);
        answer = `[Gemini API Offline/Overloaded - Simulated RAG Response]\n\n` + getMockRagResponse(question, retrievedContext);
      }
    } else {
      answer = getMockRagResponse(question, retrievedContext);
    }

    // 🎯 Calculate Ground-Truth Expected Answer Alignment Score
    let alignmentScore = 0;
    let alignmentFeedback = "";

    if (expectedAnswer && expectedAnswer.trim()) {
      const localScore = calculateAlignmentScore(answer, expectedAnswer);
      alignmentScore = localScore;

      if (ai) {
        try {
          const evalPrompt = 
            `Evaluate how accurately the reference target answer is matched by the generated answer.\n` +
            `Provide a semantic coverage score between 0 and 100, and a concise 2-sentence explanation.\n\n` +
            `GENERATED ANSWER:\n"${answer}"\n\n` +
            `EXPECTED REFERENCE TARGET:\n"${expectedAnswer}"\n\n` +
            `Respond STRICTLY in JSON format:\n` +
            `{\n` +
            `  "score": <number>,\n` +
            `  "reason": "<reasoning text>"\n` +
            `}`;

          const evalResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: evalPrompt,
            config: {
              responseMimeType: "application/json",
              temperature: 0.1,
            }
          });
          if (evalResponse.text) {
            const evalResObj = JSON.parse(evalResponse.text.trim());
            if (typeof evalResObj.score === "number") {
              alignmentScore = Math.min(100, Math.max(0, evalResObj.score));
            }
            if (evalResObj.reason) {
              alignmentFeedback = evalResObj.reason;
            }
          }
        } catch (evalErr) {
          console.error("Failed semantic evaluation:", evalErr);
          alignmentFeedback = `Semantic evaluation offline. Fast string overlap score is ${localScore}%.`;
        }
      } else {
        alignmentFeedback = `Grounded on fast keyword match. Configure your Gemini API secret key to enable intelligent AI matching evaluation!`;
      }
    }

    // Calculations and Stats
    const charactersCount = documentText.length;
    const wordsCount = documentText.split(/\s+/).filter(Boolean).length;
    const responseWords = answer.split(/\s+/).filter(Boolean).length;

    const result: RagResult = {
      chunks: finalChunks,
      queryVector,
      topKChunks,
      contextSent: fullPromptToLlm,
      systemInstructionUsed,
      answer,
      usingMockAI,
      expectedAnswer,
      alignmentScore: expectedAnswer ? alignmentScore : undefined,
      alignmentFeedback: expectedAnswer ? alignmentFeedback : undefined,
      stats: {
        characters: charactersCount,
        words: wordsCount,
        estimatedTokens: Math.ceil(charactersCount / 4),
        numChunks: finalChunks.length,
        retrievedChunks: topKChunks.length,
        contextSizeChars: fullPromptToLlm.length,
        responseTokensEstimate: Math.ceil(responseWords * 1.3),
        pipelineDurationMs: Date.now() - startTime,
      },
    };

    res.json(result);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || "An error occurred during RAG pipeline execution." });
  }
});

// Standalone server startup config (skip if Vercel serverless environment is active)
async function startServer() {
  const PORT = 3000;

  if (!process.env.VERCEL) {
    if (process.env.NODE_ENV !== "production") {
      console.log("Starting server in DEVELOPMENT mode with Vite Middleware...");
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      console.log("Starting server in PRODUCTION mode...");
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`RAG Learning Playground server listening on port ${PORT}`);
    });
  }
}

startServer();
