/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RagChunk, RagResult } from "./types";

/**
 * Splits text into custom-sized chunks with optional overlap, maintaining whole-word bounds where possible.
 */
export function chunkText(
  text: string,
  chunkSize: number,
  chunkOverlap: number
): { text: string; charStart: number; charEnd: number }[] {
  const chunks: { text: string; charStart: number; charEnd: number }[] = [];
  if (!text || text.trim().length === 0) return [];

  const rawText = text.replace(/\r\n/g, "\n");
  const len = rawText.length;
  let start = 0;

  while (start < len) {
    let end = start + chunkSize;
    if (end > len) {
      end = len;
    } else {
      // Find a word break to make chunks look readable
      const lastSpace = rawText.lastIndexOf(" ", end);
      if (lastSpace > start + Math.floor(chunkSize * 0.6)) {
        end = lastSpace;
      }
    }

    const content = rawText.slice(start, end).trim();
    if (content.length > 0) {
      chunks.push({
        text: content,
        charStart: start,
        charEnd: end,
      });
    }

    // Advance start position
    const advance = chunkSize - chunkOverlap;
    const step = advance > 0 ? advance : 1;
    
    // Break out if we reached the end of the text
    if (end >= len) break;
    start += step;
  }

  return chunks;
}

/**
 * Simulates a semantic embedding generator.
 * Maps text to an 8-dimensional latent vector based on keywords.
 * Returns an L2-normalized vector showing semantic categories.
 */
export function generateEmbedding(text: string): number[] {
  const categories = [
    // Dim 0: AI, Large Language Models, Intelligence
    ["ai", "artificial", "intelligence", "llm", "large", "language", "model", "gpt", "gemini", "neural", "network", "deep", "learning", "weights", "prompt", "transformer", "hallucination"],
    // Dim 1: Search, Retrieval, Databases, Indexing
    ["retrieve", "retrieval", "search", "database", "store", "db", "vector", "index", "cosine", "similarity", "embedding", "query", "fetch", "find", "chunk", "overlap"],
    // Dim 2: Management, Product, User Experience & Agile Scrum Methodology
    ["user", "person", "product", "manager", "pm", "builder", "app", "application", "software", "use", "interact", "experience", "business", "design", "scrum", "agile", "sprint", "planning", "attendees", "attendee", "meeting", "owner", "master", "developer", "developers", "backlog", "role", "roles", "participant", "participants", "team"],
    // Dim 3: General Writing, Docs, Files & Science Atmospheric Layers
    ["text", "write", "pasted", "notes", "article", "summary", "book", "pdf", "word", "character", "token", "sentence", "paragraph", "document", "atmosphere", "layer", "layers", "troposphere", "stratosphere", "mesosphere", "exosphere", "air", "temperature", "earth"],
    // Dim 4: Mathematics, Algorithms, Geometry
    ["math", "calculate", "algorithm", "dimension", "space", "numeric", "number", "score", "percentage", "dot", "product", "metric", "distance"],
    // Dim 5: Education, Learning, Playground
    ["learn", "playground", "education", "tutorial", "student", "teacher", "explain", "concept", "slide", "guide", "understand", "beginner"],
    // Dim 6: Systems, Cloud, API Infrastructure
    ["system", "run", "process", "pipeline", "execution", "server", "backend", "cloud", "api", "flow", "step", "compute", "client"],
    // Dim 7: Context, Augmentation, Grounding
    ["rag", "augment", "generation", "context", "grounding", "knowledge", "source", "prompt", "inputs", "output"]
  ];

  const words = text.toLowerCase().split(/[^a-z0-9]+/);
  // Base representation
  const v = new Array(8).fill(0.12);

  // Score categories
  for (const word of words) {
    if (!word) continue;
    for (let idx = 0; idx < 8; idx++) {
      if (categories[idx].includes(word)) {
        v[idx] += 0.38;
      }
    }
  }

  // Deterministic salt based on the characters to make every chunk trace unique
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    v[i % 8] += (charCode % 7) * 0.007;
  }

  // Compute L2 Norm (length of vector)
  let sumSq = 0;
  for (let i = 0; i < 8; i++) {
    sumSq += v[i] * v[i];
  }
  const norm = Math.sqrt(sumSq) || 1;

  // Normalize
  return v.map(val => Number((val / norm).toFixed(4)));
}

/**
 * Calculates cosine similarity between two unit vectors. Since the vectors are pre-normalized,
 * this is computationally equivalent to their dot product.
 */
export function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
  }
  return Number(dotProduct.toFixed(4));
}

/**
 * Generates an intelligent, non-hallucinated QA response derived directly from the
 * retrieved text context when GEMINI_API_KEY is not configured or offline.
 */
export function getMockRagResponse(question: string, context: string): string {
  if (!context || !context.trim() || context.includes("[No relevant context retrieved]")) {
    return `Based on the retrieved context, there is no sufficient information in the provided document to answer your question. (RAG Out-of-Domain Grounding fallback!)`;
  }

  // Clean the question and extract matching key concept words
  const cleanQ = question.toLowerCase().replace(/[^a-z0-9\s]/g, "");
  const stopWords = new Set([
    "what", "is", "the", "in", "of", "and", "a", "who", "are", "how", "does", "do", "you", "to", "for", "on", "with", "as", "by", "at", "an", "be", "this", "that", "from", "any", "which", "about"
  ]);
  const qWords = cleanQ.split(/\s+/).filter(w => w.length > 1 && !stopWords.has(w));

  // Extract all individual sentences or paragraphs from the retrieved context (skipping RAG UI headers)
  const lines = context.split("\n");
  const extractedSentences: string[] = [];

  for (const line of lines) {
    if (line.trim().startsWith("[Source Chunk") || line.trim().startsWith("---") || !line.trim()) {
      continue;
    }
    // Split sentences using regex lookbehind
    const sentences = line.split(/(?<=[.!?])\s+/);
    for (const s of sentences) {
      if (s.trim().length > 8) {
        extractedSentences.push(s.trim());
      }
    }
  }

  // Score each individual retrieved sentence by question keyword matches
  const scoredSentences = extractedSentences.map(sentence => {
    const cleanS = sentence.toLowerCase().replace(/[^a-z0-9\s]/g, "");
    const sWords = new Set(cleanS.split(/\s+/));
    let score = 0;
    
    for (const qw of qWords) {
      if (sWords.has(qw)) {
        score += 2; // direct match
      } else {
        // partial word matching
        for (const sw of sWords) {
          if (sw.startsWith(qw) || qw.startsWith(sw)) {
            score += 0.8;
            break;
          }
        }
      }
    }
    return { sentence, score };
  });

  // Filter out zero-overlap sentences and sort starting with highest scores
  const matching = scoredSentences
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (matching.length > 0) {
    // Unique sentences compiler
    const seen = new Set<string>();
    const topSentences: string[] = [];
    for (const item of matching) {
      if (!seen.has(item.sentence)) {
        seen.add(item.sentence);
        topSentences.push(item.sentence);
      }
      if (topSentences.length >= 3) break;
    }

    const compiledAnswer = topSentences.join(" ");
    return `[Simulated RAG Answer]\n\nBased on your retrieved text database, here is the factual match compiled:\n\n"${compiledAnswer}"\n\n(This answer was retrieved directly from matching source chunks, ensuring 100% factual accuracy in offline mode).`;
  }

  // Fallback if no exact keywords overlapped but context chunks do exist
  if (extractedSentences.length > 0) {
    const backupText = extractedSentences.slice(0, 2).join(" ");
    return `[Simulated RAG Answer]\n\nI was unable to locate an exact keyword match for your query, but the retrieved document segments contain the following facts:\n\n"${backupText}"\n\nIf this isn't what you were looking for, try adjusting your query terms or customizing the segment sizes!`;
  }

  return `Based on the retrieved context, there is no sufficient information in the provided document to answer your question.`;
}
