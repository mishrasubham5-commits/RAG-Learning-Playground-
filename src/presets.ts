/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PresetModel {
  name: string;
  description: string;
  document: string;
  question: string;
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  expectedAnswer?: string;
}

export const PRESETS: PresetModel[] = [
  {
    name: "🚀 What is RAG? (Introduction)",
    description: "Learn how RAG connects external texts with large language models.",
    document: 
      "Retrieval-Augmented Generation (RAG) is an architectural pattern that optimizes the output of classical Large Language Models (LLMs).\n\n" +
      "Instead of relying purely on static knowledge frozen inside model weights during pre-training, RAG dynamically fetches relevant text chunks from an external database at runtime. " +
      "These text chunks are injected directly into the user prompt, giving the model real-time, grounded facts to answer from.\n\n" +
      "The primary benefit of RAG is that it dramatically reduces LLM hallucinations. Hallucinations occur when a model confidentially speaks false information because it lacks original training context. " +
      "With RAG, the LLM functions less like an 'all-knowing oracle' and more like a 'smart researcher' reading a set of specific reference cards.",
    question: "What is the primary benefit of RAG and how does it prevent hallucinations?",
    chunkSize: 150,
    chunkOverlap: 45,
    topK: 2,
    expectedAnswer: "RAG dramatically reduces hallucinations by injecting real-time factual text chunks into the user prompt from an external database."
  },
  {
    name: "🧠 Vector DBs & Embeddings",
    description: "Simulate how mathematical vectors capture textual meaning.",
    document:
      "To perform semantic search, computers convert human letters and sentences into mathematical lists of numbers called embeddings.\n\n" +
      "An embedding is a high-dimensional vector representing latent concepts. For example, the sentence 'I love writing code' will be situated closely in vector space to 'Programming is my passion' because they share semantic meaning, even if they share zero matching words.\n\n" +
      "Specialized vector databases, such as Pinecone, Milvus, or pgvector, are configured to index these embeddings. " +
      "When a query arrives, the database calculates similarity using formulas like Cosine Similarity or Dot Product, instantly retrieving the most relevant database items in microseconds.",
    question: "How do vector databases retrieve relevant items and what formula is used?",
    chunkSize: 180,
    chunkOverlap: 40,
    topK: 2,
    expectedAnswer: "Vector databases use high-dimensional embeddings and calculate similarity index matches using formulas like Cosine Similarity or Dot Product."
  },
  {
    name: "📅 Sprint Planning (Agile Scrum)",
    description: "Learn who joins Sprint Planning and who is responsible for backlog items.",
    document:
      "Sprint Planning is a highly collaborative event in Scrum. The core attendees who must participate are the full Scrum Team: the Product Owner (PO), the Scrum Master (SM), and the Developers.\n\n" +
      "The Product Owner introduces the Sprint Goal and discusses high-priority product backlog items. " +
      "The Developers select the exact backlog items they will commit to, estimate the task workload, and describe how they will execute it. " +
      "The Scrum Master acts as a coach and facilitator, ensuring the meeting runs smoothly and stays within the time-box limit.\n\n" +
      "Subject-matter experts or external consultants might occasionally join by invitation to give guidance on technical complexities, but the core participants are strictly the Scrum Team.",
    question: "who are the attendees in sprint planning?",
    chunkSize: 140,
    chunkOverlap: 35,
    topK: 2,
    expectedAnswer: "The core attendees who must participate in sprint planning are the full Scrum Team, which includes the Product Owner, the Scrum Master, and the Developers."
  },
  {
    name: "🛑 Out-of-Domain Grounding (RAG Fallback)",
    description: "See how RAG successfully prevents models from fabricating answers.",
    document:
      "The atmosphere of Earth is divided into multiple temperature layers.\n\n" +
      "The lowest layer is the Troposphere, extending from the ground up to roughly 12 kilometers high. This layer contains almost all weather patterns and water vapor.\n\n" +
      "Above the troposphere lies the Stratosphere, reaching upward to 50 kilometers. The ozone layer resides here, absorbing harmful solar radiation.\n\n" +
      "The third layer is the Mesosphere, where temperatures drop down to -90 degrees Celsius. It's the coldest region of Earth's atmosphere.",
    question: "What are the characteristics of the Exosphere?",
    chunkSize: 160,
    chunkOverlap: 30,
    topK: 2,
    expectedAnswer: "The exosphere is completely absent from the retrieved chunks, so the grounded bot must fallback stating there is no sufficient information."
  }
];
