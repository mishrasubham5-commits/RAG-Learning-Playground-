/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface RagChunk {
  id: number;
  text: string;
  charStart: number;
  charEnd: number;
  vector: number[]; // 8-D simulated embedding
  similarity?: number;
  rank?: number;
  selected?: boolean;
}

export interface RagPipelineStep {
  name: string;
  title: string;
  description: string;
  status?: "idle" | "running" | "completed" | "failed";
  durationMs?: number;
  details?: string;
}

export interface RagResult {
  chunks: RagChunk[];
  queryVector: number[];
  topKChunks: RagChunk[];
  contextSent: string;
  systemInstructionUsed: string;
  answer: string;
  usingMockAI: boolean;
  expectedAnswer?: string;
  alignmentScore?: number;
  alignmentFeedback?: string;
  stats: {
    characters: number;
    words: number;
    estimatedTokens: number;
    numChunks: number;
    retrievedChunks: number;
    contextSizeChars: number;
    responseTokensEstimate: number;
    pipelineDurationMs: number;
  };
}
