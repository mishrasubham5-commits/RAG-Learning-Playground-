/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Database,
  Search,
  FileText,
  Layers,
  Cpu,
  Bookmark,
  RefreshCw,
  Play,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Gauge,
  Terminal,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  BookOpen,
  MessageSquare,
  Send,
  Trash2,
  User,
  Info,
  Maximize2,
  Check,
  Award,
  Zap,
  Lock
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { RagChunk, RagResult, RagPipelineStep } from "./types";
import { PRESETS, PresetModel } from "./presets";

interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: Date;
  ragResult?: RagResult; // Attach full RAG telemetry so students can audit matches of specific messages!
  isComputing?: boolean;
}

export default function App() {
  // Input Document Configuration
  const [documentText, setDocumentText] = useState<string>(PRESETS[0].document);
  const [question, setQuestion] = useState<string>(PRESETS[0].question);
  const [chunkSize, setChunkSize] = useState<number>(PRESETS[0].chunkSize);
  const [chunkOverlap, setChunkOverlap] = useState<number>(PRESETS[0].chunkOverlap);
  const [topK, setTopK] = useState<number>(PRESETS[0].topK);
  const [activePresetIndex, setActivePresetIndex] = useState<number>(0);
  const [expectedAnswer, setExpectedAnswer] = useState<string>(PRESETS[0].expectedAnswer || "");
  const [enableExpectedEvaluation, setEnableExpectedEvaluation] = useState<boolean>(true);

  // Simulation/Pipeline State
  const [activeStepIndex, setActiveStepIndex] = useState<number>(-1);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationMode, setSimulationMode] = useState<"auto" | "step">("auto");
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1000); // ms per step
  const [isFetchPending, setIsFetchPending] = useState<boolean>(false);

  // Search Results & Interactive states
  const [ragResult, setRagResult] = useState<RagResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedChunkId, setSelectedChunkId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"pipeline" | "knowledge">("pipeline");

  // Chatbot State
  const [chatInput, setChatInput] = useState<string>("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      id: "welcome-msg",
      sender: "bot",
      text: "Hello! Feed me any document text on the left, and ask me specific questions here. I will query the text database, retrieve the exact matching chunks, and answer with 100% facts only!",
      timestamp: new Date()
    }
  ]);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Live Stats
  const [liveStats, setLiveStats] = useState({
    chars: 0,
    words: 0,
    tokens: 0,
  });

  useEffect(() => {
    const chars = documentText.length;
    const words = documentText.split(/\s+/).filter(Boolean).length;
    const tokens = Math.ceil(chars / 4);
    setLiveStats({ chars, words, tokens });
  }, [documentText]);

  // Scroll to bottom of chat when history changes
  const [apiStatus, setApiStatus] = useState<{ usingMockAI: boolean; hasApiKeyConfigured: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((res) => res.json())
      .then((data) => setApiStatus(data))
      .catch((err) => console.error("Failed to fetch API status", err));
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  // Automatically trigger baseline chunking preview when text changes
  const [baselineChunksCount, setBaselineChunksCount] = useState<number>(0);
  useEffect(() => {
    if (documentText.trim()) {
      // Fast count simulation
      const count = Math.max(1, Math.ceil(documentText.length / (chunkSize - chunkOverlap || 1)));
      setBaselineChunksCount(count);
    } else {
      setBaselineChunksCount(0);
    }
  }, [documentText, chunkSize, chunkOverlap]);

  // Handle Loading Preset
  const handleLoadPreset = (index: number) => {
    const p = PRESETS[index];
    setDocumentText(p.document);
    setQuestion(p.question);
    setChunkSize(p.chunkSize);
    setChunkOverlap(p.chunkOverlap);
    setTopK(p.topK);
    setExpectedAnswer(p.expectedAnswer || "");
    setActivePresetIndex(index);
    setRagResult(null);
    setActiveStepIndex(-1);
    setIsSimulating(false);
    setErrorMessage(null);

    // Seed welcoming message representing preset prompt suggestion
    setChatHistory((current) => [
      ...current,
      {
        id: `preset-seed-${Date.now()}`,
        sender: "bot",
        text: `Loaded preset: "${p.name}". I updated the text database guidelines. Try asking: "${p.question}"`,
        timestamp: new Date()
      }
    ]);
  };

  // Run full pipeline via visual sequencer block
  const runRagPipeline = async (customQuery?: string) => {
    const targetQuery = customQuery || question;
    if (!documentText.trim()) {
      setErrorMessage("Please supply a source document text in Section 2 first.");
      return;
    }
    if (!targetQuery.trim()) {
      setErrorMessage("Please enter a question to run search queries.");
      return;
    }

    setErrorMessage(null);
    setIsSimulating(true);
    setSimulationMode("auto");
    setRagResult(null);

    // Step-by-Step sequence generator
    for (let i = 0; i < 7; i++) {
      setActiveStepIndex(i);
      await new Promise((resolve) => setTimeout(resolve, playbackSpeed));
    }

    setActiveStepIndex(7);
    setIsFetchPending(true);

    try {
      const res = await fetch("/api/rag/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentText,
          question: targetQuery,
          chunkSize,
          chunkOverlap,
          topK,
          expectedAnswer: (enableExpectedEvaluation && expectedAnswer.trim()) ? expectedAnswer : undefined,
        }),
      });

      if (!res.ok) {
        const errDetails = await res.json();
        throw new Error(errDetails.error || "RAG engine calculation failed.");
      }

      const data: RagResult = await res.json();
      setRagResult(data);
      setApiStatus({
        usingMockAI: data.usingMockAI,
        hasApiKeyConfigured: !data.usingMockAI
      });
      setIsFetchPending(false);
      setIsSimulating(false);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to finalize RAG pipeline compilation.");
      setIsFetchPending(false);
      setIsSimulating(false);
      setActiveStepIndex(-1);
    }
  };

  // Step-by-step interactive configurationdebugger
  const startStepByStep = () => {
    if (!documentText.trim() || !question.trim()) {
      setErrorMessage("Please configure both document text and a question first.");
      return;
    }
    setErrorMessage(null);
    setRagResult(null);
    setIsSimulating(true);
    setSimulationMode("step");
    setActiveStepIndex(0);
  };

  const handleNextStep = async () => {
    if (activeStepIndex < 6) {
      setActiveStepIndex((prev) => prev + 1);
    } else if (activeStepIndex === 6) {
      setActiveStepIndex(7);
      setIsFetchPending(true);
      try {
        const res = await fetch("/api/rag/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentText,
            question,
            chunkSize,
            chunkOverlap,
            topK,
            expectedAnswer: (enableExpectedEvaluation && expectedAnswer.trim()) ? expectedAnswer : undefined,
          }),
        });

        if (!res.ok) {
          const errDetails = await res.json();
          throw new Error(errDetails.error || "Server RAG Error.");
        }

        const data: RagResult = await res.json();
        setRagResult(data);
        setApiStatus({
          usingMockAI: data.usingMockAI,
          hasApiKeyConfigured: !data.usingMockAI
        });
        setIsFetchPending(false);
        setIsSimulating(false);
      } catch (err: any) {
        console.error(err);
        setErrorMessage(err.message || "Endpoint error during manual step debug.");
        setIsFetchPending(false);
        setIsSimulating(false);
        setActiveStepIndex(-1);
      }
    }
  };

  const handleReset = () => {
    setActiveStepIndex(-1);
    setIsSimulating(false);
    setRagResult(null);
    setErrorMessage(null);
  };

  // Chatbot question submission handler
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = chatInput.trim();
    if (!query) return;

    if (!documentText.trim()) {
      setChatHistory((curr) => [
        ...curr,
        {
          id: `err-${Date.now()}`,
          sender: "bot",
          text: "⚠️ Please insert a source document on the left panel so I have knowledge data to search from!",
          timestamp: new Date()
        }
      ]);
      setChatInput("");
      return;
    }

    const userMsgId = `user-${Date.now()}`;
    const botMsgId = `bot-${Date.now()}`;

    // Add user message to chat history
    const userMessage: ChatMessage = {
      id: userMsgId,
      sender: "user",
      text: query,
      timestamp: new Date()
    };

    const pendingBotMessage: ChatMessage = {
      id: botMsgId,
      sender: "bot",
      text: "Searching vector indices, calculating cosine distance, and generating answer...",
      timestamp: new Date(),
      isComputing: true
    };

    setChatHistory((current) => [...current, userMessage, pendingBotMessage]);
    setChatInput("");

    // Automatically trigger the dynamic visualization sequencer so the user can watch the map/chunks update
    setQuestion(query);

    try {
      const res = await fetch("/api/rag/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentText,
          question: query,
          chunkSize,
          chunkOverlap,
          topK,
          expectedAnswer: (enableExpectedEvaluation && expectedAnswer.trim()) ? expectedAnswer : undefined,
        }),
      });

      if (!res.ok) {
        throw new Error("RAG Chat processing failed.");
      }

      const data: RagResult = await res.json();
      
      // Update the main RAG visualizer state so the user sees the latest coordinates & matching chunks
      setRagResult(data);
      setApiStatus({
        usingMockAI: data.usingMockAI,
        hasApiKeyConfigured: !data.usingMockAI
      });
      setActiveStepIndex(7);

      // Overwrite the pending message with actual answer and telemetry context
      setChatHistory((current) =>
        current.map((msg) =>
          msg.id === botMsgId
            ? {
                ...msg,
                text: data.answer,
                isComputing: false,
                ragResult: data
              }
            : msg
        )
      );
    } catch (err: any) {
      setChatHistory((current) =>
        current.map((msg) =>
          msg.id === botMsgId
            ? {
                ...msg,
                text: "❌ Sorry, I encountered an error while searching the vector chunks index. Please try again.",
                isComputing: false
              }
            : msg
        )
      );
    }
  };

  const handleClearChat = () => {
    setChatHistory([
      {
        id: "welcome-msg",
        sender: "bot",
        text: "Chatbox cleared. Ask me any question related to the source text on the left!",
        timestamp: new Date()
      }
    ]);
  };

  // Helper projection function from 8D vector to 2D plot metrics
  const get2DCoordinates = (vector: number[]) => {
    if (!vector || vector.length < 8) return { x: 150, y: 100 };
    // Projection equations for distinct visual spreading on light coordinate graph
    const rawX = (vector[0] * 1.5 + vector[1] * 1.2) - (vector[2] * 0.85 + vector[3] * 1.15);
    const rawY = (vector[4] * 1.45 + vector[6] * 1.25) - (vector[5] * 0.9 + vector[7] * 1.35);
    const scale = 115;
    const x = 150 + rawX * scale;
    const y = 95 - rawY * scale; // invert Y coordinate for SVG standard viewport orientation
    return {
      x: Math.max(30, Math.min(270, x)),
      y: Math.max(25, Math.min(165, y)),
    };
  };

  const mockQueryVector = ragResult ? ragResult.queryVector : [0.32, 0.48, 0.18, 0.12, 0.28, 0.22, 0.38, 0.58];
  const queryCoords = get2DCoordinates(mockQueryVector);

  const stepsList: { name: string; title: string; description: string; detailLabel: string }[] = [
    {
      name: "input",
      title: "1. Document Intake",
      description: "Extracting complete text characters and metrics database size.",
      detailLabel: `Document size: ${liveStats.chars} characters.`
    },
    {
      name: "chunking",
      title: "2. Text Chunking",
      description: "Splitting input into smaller segments to maintain local semantics within token thresholds.",
      detailLabel: `Chunk size setting: ${chunkSize} chars, overlap: ${chunkOverlap} chars.`
    },
    {
      name: "embedding",
      title: "3. Semantic Embedding",
      description: "Converting word concepts into numerical arrays representing latent topic coordinates.",
      detailLabel: "Computing 8D mathematical weights representational models."
    },
    {
      name: "vectorDb",
      title: "4. Indexing Database",
      description: "Storing chunk vectors neatly into a spatial collection index.",
      detailLabel: "Pre-indexed ready for nearest-neighbor distance computations."
    },
    {
      name: "simSearch",
      title: "5. Context Retrieval",
      description: "Generating query vectors & evaluating math cosine angle distance.",
      detailLabel: `Current query: "${question}"`
    },
    {
      name: "ranking",
      title: "6. Score Filtering",
      description: "Sorting chunks from highest similarity score down to filter top candidates.",
      detailLabel: `Selecting Top K: ${topK}`
    },
    {
      name: "augmentation",
      title: "7. Prompt Augmentation",
      description: "Packaging retrieved document facts safely inside strict system instruction prompts.",
      detailLabel: "Injecting facts securely into the temporary context window."
    },
    {
      name: "llm",
      title: "8. Grounded LLM Response",
      description: "The AI answers using strictly the validated context facts without fabricating answers.",
      detailLabel: "Grounded output response prepared."
    }
  ];

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-slate-800 font-sans antialiased selection:bg-indigo-100 selection:text-indigo-900 pb-16">
      
      {/* Decorative colored glow circles (subtle gradients) */}
      <div className="absolute top-0 left-0 right-0 h-80 bg-gradient-to-b from-white to-transparent pointer-events-none z-0" />
      <div className="absolute top-12 left-10 w-96 h-96 bg-indigo-200/40 blur-[130px] rounded-full pointer-events-none z-0" />
      <div className="absolute top-24 right-12 w-80 h-80 bg-emerald-100/40 blur-[120px] rounded-full pointer-events-none z-0" />

      {/* Header ribbon branding */}
      <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-indigo-950 text-white text-[11px] md:text-xs py-2 px-4 relative z-10 font-medium shadow-sm flex flex-col md:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 justify-center">
          <Sparkles className="w-4 h-4 text-cyan-300 animate-pulse" />
          <span>Interactive Walkthrough for RAG Systems (Retrieval-Augmented Generation) &bull; @google/genai SDK</span>
        </div>
        {apiStatus && (
          <div className="flex items-center gap-2">
            {apiStatus.hasApiKeyConfigured ? (
              <span className="inline-flex items-center gap-1 bg-emerald-500/25 border border-emerald-400 text-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                Live Gemini AI Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 bg-amber-500/25 border border-amber-400 text-amber-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                Offline Simulator Mode (No API Key)
              </span>
            )}
          </div>
        )}
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        
        {/* Header Hero Section */}
        <header className="mb-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
              RAG Learning Playground <span className="text-xs font-bold font-mono tracking-widest uppercase bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded">v1.1</span>
            </h1>
            <p className="text-slate-600 text-sm mt-1 leading-relaxed">
              Understand how models use custom files to speak truths without hallucinating. Tinker with parameters on the left, watch the visual vector pipeline in the center, or query the <strong>interactive chatbot panel</strong> on the right!
            </p>
          </div>

          {/* Quick Scenario Picker with animation */}
          <div className="shrink-0 bg-slate-50 p-2 rounded-xl border border-slate-200">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5 px-2 flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-indigo-600" /> Preload Learning Scenario
            </div>
            <div className="flex flex-wrap gap-1">
              {PRESETS.map((p, index) => (
                <button
                  key={p.name}
                  onClick={() => handleLoadPreset(index)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activePresetIndex === index
                      ? "bg-indigo-600 text-white shadow-sm shadow-indigo-950/20"
                      : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-200"
                  }`}
                >
                  {p.name.split(" ")[0]} {p.name.replace(/^[^\s]+\s*/, "").replace(/\s*\(.*\)/, "")}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Global Error message container */}
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3 shadow-sm"
          >
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm text-rose-900">Pipeline Config Warning</h4>
              <p className="text-xs mt-1 leading-relaxed">{errorMessage}</p>
            </div>
          </motion.div>
        )}

        {/* Main Tri-Frame Bento Grid layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: Data parameters setup & Text insertion - spans 4 cols */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* 1. Technical RAG Settings (Sliding parameters card) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-400 to-indigo-500" />
              
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-600" /> 1. Text Segmentation Knobs
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">Parameters</span>
              </div>

              <div className="space-y-4">
                
                {/* Chunk Size */}
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-600">Chunk Size (Characters)</span>
                    <span className="font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">{chunkSize} Chars</span>
                  </div>
                  <input
                    type="range"
                    min="60"
                    max="450"
                    step="10"
                    value={chunkSize}
                    onChange={(e) => {
                      setChunkSize(Number(e.target.value));
                      setRagResult(null); // invalidate cached calculations
                    }}
                    className="w-full accent-indigo-600 bg-slate-100 h-1.5 rounded-lg cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Character limits determine document slicing. Best practice targets logical paragraphs.
                  </p>
                </div>

                {/* Chunk Overlap */}
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-600">Overlap Redundancy</span>
                    <span className="font-mono text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded">{chunkOverlap} Chars</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="140"
                    step="5"
                    value={chunkOverlap}
                    disabled={chunkOverlap >= chunkSize}
                    onChange={(e) => {
                      setChunkOverlap(Number(e.target.value));
                      setRagResult(null);
                    }}
                    className="w-full accent-cyan-600 bg-slate-100 h-1.5 rounded-lg cursor-pointer disabled:opacity-50"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Duplicated text at the start/end of consecutive blocks ensures phrases aren't clipped during indexing.
                  </p>
                </div>

                {/* Top-K Retrieval Depth */}
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1.5">
                    <span className="text-slate-600">Retrieval Count (Top K)</span>
                    <span className="font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">K = {topK} Chunks</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[1, 2, 3].map((num) => (
                      <button
                        key={num}
                        onClick={() => {
                          setTopK(num);
                          setRagResult(null);
                        }}
                        className={`py-1 rounded-lg text-xs font-bold transition-all ${
                          topK === num
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                        }`}
                      >
                        {num} {num === 1 ? "Chunk" : "Chunks"}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5">
                    The absolute number of winning chunks fetched from the vector DB to augments the LLM question context.
                  </p>
                </div>

              </div>
            </div>

            {/* 2. Source Document Text Input Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-1">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" /> 2. Loaded Text Database
                </h3>
                <span className="text-[9px] font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200/50 uppercase font-bold animate-pulse">
                  {baselineChunksCount} Chunks
                </span>
              </div>

              {/* Text area for user copy paste */}
              <div>
                <textarea
                  id="document-source-text-playground"
                  value={documentText}
                  onChange={(e) => {
                    setDocumentText(e.target.value);
                    setRagResult(null);
                  }}
                  placeholder="Paste custom document contents (e.g. manuals, summaries, essays)..."
                  rows={8}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono leading-relaxed resize-y"
                />
              </div>

              {/* Text metric gauges */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                <div>
                  <div className="text-[9px] text-slate-500 uppercase tracking-wider">Chars</div>
                  <div className="text-xs font-bold text-slate-800">{liveStats.chars}</div>
                </div>
                <div>
                  <div className="text-[9px] text-slate-500 uppercase tracking-wider">Words</div>
                  <div className="text-xs font-bold text-slate-800">{liveStats.words}</div>
                </div>
                <div>
                  <div className="text-[9px] text-slate-500 uppercase tracking-wider">Est. Tokens</div>
                  <div className="text-xs font-bold text-indigo-600">{liveStats.tokens}</div>
                </div>
              </div>

              {/* Test question input under text area */}
              <div className="pt-2 border-t border-slate-100 space-y-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Search className="w-3.5 h-3.5 text-indigo-600" /> Pipeline Question
                  </label>
                  <input
                    type="text"
                    id="pipeline-question-input"
                    value={question}
                    onChange={(e) => {
                      setQuestion(e.target.value);
                      setRagResult(null);
                    }}
                    placeholder="Ask a question about the document text..."
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Target Expected Answer
                    </label>
                    <button
                      type="button"
                      onClick={() => setEnableExpectedEvaluation(!enableExpectedEvaluation)}
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded transition-all ${
                        enableExpectedEvaluation 
                          ? "bg-emerald-55 text-emerald-700 border border-emerald-200 bg-emerald-50" 
                          : "bg-slate-100 text-slate-400 border border-slate-200"
                      }`}
                    >
                      {enableExpectedEvaluation ? "Active" : "Disabled"}
                    </button>
                  </div>
                  {enableExpectedEvaluation && (
                    <input
                      type="text"
                      value={expectedAnswer}
                      onChange={(e) => {
                        setExpectedAnswer(e.target.value);
                        setRagResult(null);
                      }}
                      placeholder="e.g. PO, Scrum Master, and Developers (Verify accuracy!)"
                      className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  )}
                </div>
              </div>

              {/* Action Buttons for pipeline debugging */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  id="pipeline-run-auto-btn"
                  onClick={() => runRagPipeline()}
                  disabled={isSimulating || !documentText.trim() || !question.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs py-2.5 px-3 rounded-xl transition duration-150 flex items-center justify-center gap-1 shadow-sm"
                >
                  {isSimulating && simulationMode === "auto" ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Run Pipeline
                    </>
                  )}
                </button>

                <button
                  id="pipeline-run-step-btn"
                  onClick={startStepByStep}
                  disabled={isSimulating || !documentText.trim() || !question.trim()}
                  className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-50 disabled:text-slate-300 text-white font-semibold text-xs py-2.5 px-3 rounded-xl transition duration-150 flex items-center justify-center gap-1 border border-slate-200"
                >
                  <Terminal className="w-3.5 h-3.5 text-cyan-300" />
                  Step Debug
                </button>
              </div>

              {/* Speed calibration block */}
              <div className="flex items-center justify-between text-[10px] text-slate-500 bg-slate-50 p-2 rounded-lg">
                <span className="font-semibold flex items-center gap-1"><Zap className="w-3 h-3 text-amber-500 animate-pulse" /> Sim Delay Step:</span>
                <div className="flex gap-1">
                  {[500, 1000, 2000].map(speed => (
                    <button
                      key={speed}
                      onClick={() => setPlaybackSpeed(speed)}
                      className={`px-2 py-0.5 rounded font-mono ${
                        playbackSpeed === speed ? "bg-indigo-600 text-white text-[9px]" : "bg-white border border-slate-200 text-slate-500"
                      }`}
                    >
                      {speed / 1000}s
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Quick Education Concept Tip Card */}
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 p-4 rounded-2xl border border-indigo-100 flex gap-3">
              <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-bold text-indigo-900">Education Tip:</span>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  RAG makes language models highly accurate for company manuals since it constrains their dynamic response capability exclusively inside the "Retrieved facts context list". Try asking about terms completely absent in the text to inspect the grounding parameters.
                </p>
              </div>
            </div>

          </div>

          {/* MAIN CENTER WORKSPACE: Animated Pipeline visualizer, chunks, and vector space - spans 5 cols */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Steps execution tracker panel */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-indigo-600" /> Visual RAG Chronology
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">Real-time status</span>
              </div>

              {/* Segmented Pipeline Steps list */}
              <div className="space-y-2">
                {stepsList.map((step, idx) => {
                  const isActive = activeStepIndex === idx;
                  const isCompleted = activeStepIndex > idx || (idx === 7 && ragResult);
                  const isUpcoming = activeStepIndex < idx && !ragResult;

                  return (
                    <div
                      key={step.name}
                      onClick={() => {
                        if (!isSimulating) {
                          setActiveStepIndex(idx);
                        }
                      }}
                      className={`p-3 rounded-xl border transition-all text-left relative cursor-pointer flex items-start gap-3 ${
                        isActive
                          ? "bg-indigo-50 border-indigo-500 shadow-sm"
                          : isCompleted
                          ? "bg-slate-50 border-slate-200/80 text-slate-700"
                          : "bg-white border-slate-100 text-slate-400 opacity-65"
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        isActive 
                          ? "bg-indigo-600 text-white scale-110" 
                          : isCompleted 
                          ? "bg-emerald-500 text-white" 
                          : "bg-slate-100 text-slate-400"
                      }`}>
                        {isCompleted && !isActive ? "✓" : idx + 1}
                      </span>

                      <div className="space-y-0.5">
                        <div className="font-bold text-xs text-slate-950 flex items-center gap-1.5">
                          {step.title}
                          {isActive && <span className="text-[9px] uppercase tracking-wider font-bold bg-indigo-100 text-indigo-700 px-1 py-0.2 rounded animate-pulse">Computing</span>}
                        </div>
                        <p className="text-[11px] text-slate-500 leading-normal">{step.description}</p>
                        
                        {/* Live parameter insight lines */}
                        {isActive && (
                          <div className="text-[10px] font-mono text-indigo-600 bg-white p-1.5 rounded-lg border border-indigo-200 mt-1">
                            &gt; {step.detailLabel}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Stop / Next button controls when stepping */}
              {isSimulating && simulationMode === "step" && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                  <span className="text-xs text-amber-800 font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" /> Breakpoint Step {activeStepIndex + 1}/8
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={handleReset}
                      className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-300 rounded text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleNextStep}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded text-xs flex items-center gap-1"
                    >
                      Next <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* INTERACTIVE VECTOR GRAPH & CHUNKS VIEW */}
            {activeStepIndex >= 2 && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-cyan-600" /> Vector DB Coordinate Map
                  </h4>
                  <span className="text-[9px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                    <Search className="w-3 h-3" /> Spatial Similarity
                  </span>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  Below is a 2D projection of the 8D semantic vectors. The star shape (<span className="text-amber-500 font-bold">&#128970;</span>) is the Question. The dots are the document text chunks. The glowing lines indicate cosine similarity calculations!
                </p>

                {/* SVG Coordinate Space Graph Component (Interactive projection space) */}
                <div className="relative bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden aspect-[3/2] flex items-center justify-center p-2">
                  {/* Grid Lines Overlay */}
                  <svg className="absolute inset-0 w-full h-full text-slate-200/70" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <pattern id="light-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#light-grid)" />
                    <line x1="0" y1="95" x2="300" y2="95" stroke="#CBD5E1" strokeWidth="0.8" strokeDasharray="3 3" />
                    <line x1="150" y1="0" x2="150" y2="190" stroke="#CBD5E1" strokeWidth="0.8" strokeDasharray="3 3" />
                  </svg>

                  <svg viewBox="0 0 300 190" className="w-full h-full relative z-10 select-none">
                    
                    {/* Laser connection similarity vectors */}
                    {ragResult && ragResult.chunks.map(chunk => {
                      const pt = get2DCoordinates(chunk.vector);
                      return (
                        <g key={chunk.id}>
                          {chunk.selected ? (
                            <line
                              x1={pt.x}
                              y1={pt.y}
                              x2={queryCoords.x}
                              y2={queryCoords.y}
                              stroke="#6366F1"
                              strokeWidth="1.5"
                              strokeDasharray="2 2"
                              className="animate-pulse"
                            />
                          ) : (
                            <line
                              x1={pt.x}
                              y1={pt.y}
                              x2={queryCoords.x}
                              y2={queryCoords.y}
                              stroke="#94A3B8"
                              strokeWidth="0.5"
                              strokeDasharray="3 5"
                              opacity="0.6"
                            />
                          )}
                        </g>
                      );
                    })}

                    {/* Golden Question vector star */}
                    <g transform={`translate(${queryCoords.x}, ${queryCoords.y})`}>
                      <circle r="14" className="fill-amber-500/10 stroke-amber-500/40" strokeWidth="0.8" />
                      <circle r="7" className="fill-amber-500/30 animate-ping" />
                      <polygon points="0,-7 2,-2 7,0 2,2 0,7 -2,2 -7,0 -2,-2" className="fill-amber-500 stroke-amber-600" strokeWidth="0.5" />
                    </g>
                    <text x={queryCoords.x + 9} y={queryCoords.y - 8} fill="#B45309" fontSize="7" fontWeight="bold" fontFamily="monospace" className="bg-white">
                      QUERY
                    </text>

                    {/* Plots of matching Chunk nodes (Indigo = selected, Slate = unselected) */}
                    {ragResult ? (
                      ragResult.chunks.map(chunk => {
                        const pt = get2DCoordinates(chunk.vector);
                        const isSelected = chunk.selected;

                        return (
                          <g
                            key={chunk.id}
                            className="cursor-pointer group"
                            onClick={() => setSelectedChunkId(chunk.id === selectedChunkId ? null : chunk.id)}
                          >
                            {isSelected && (
                              <circle
                                cx={pt.x}
                                cy={pt.y}
                                r="8"
                                className="fill-none stroke-indigo-500 animate-pulse"
                                strokeWidth="1"
                              />
                            )}
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r="5"
                              className={`transition-colors duration-200 ${
                                isSelected ? "fill-indigo-600 stroke-white" : "fill-slate-400 hover:fill-slate-600 stroke-white"
                              }`}
                              strokeWidth="0.8"
                            />
                            <text
                              x={pt.x + 7}
                              y={pt.y + 3}
                              fill={isSelected ? "#4F46E5" : "#475569"}
                              fontSize="6"
                              fontWeight="bold"
                              fontFamily="monospace"
                            >
                              C{chunk.id} ({Math.round((chunk.similarity || 0) * 100)}%)
                            </text>
                          </g>
                        );
                      })
                    ) : (
                      // While simulating steps, placeholder animation nodes
                      [1, 2, 3].map((id, i) => {
                        const x = 70 + i * 80;
                        const y = 50 + (i % 2) * 60;
                        return (
                          <circle
                            key={id}
                            cx={x}
                            cy={y}
                            r="4"
                            className="fill-slate-300 animate-bounce"
                            style={{ animationDelay: `${i * 150}ms` }}
                          />
                        );
                      })
                    )}
                  </svg>
                </div>

                {/* Mathematical Dimension Table indicator */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    Query Embedding Dimensions [8D]
                  </div>
                  <div className="grid grid-cols-8 gap-1.5 text-center font-mono">
                    {mockQueryVector.map((val, idx) => (
                      <div key={idx} className="bg-white p-1 rounded border border-slate-200">
                        <span className="text-[8px] text-slate-400 block font-sans">D{idx+1}</span>
                        <span className="text-[10px] font-bold text-indigo-700">{val.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <span className="text-[9px] text-slate-400 block mt-1.5 italic text-center font-mono font-medium">
                    Calculated via L2-normalized concept categories vectors.
                  </span>
                </div>

              </div>
            )}

            {/* List of segment text data chunks */}
            {activeStepIndex >= 1 && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-600" /> Database Chunk Segments
                  </h4>
                  <span className="text-[9px] text-slate-500 font-mono">Click to audit mathematical details</span>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {ragResult ? (
                    ragResult.chunks.map(chunk => {
                      const isRetrieved = chunk.selected;
                      const isInspected = selectedChunkId === chunk.id;

                      return (
                        <div
                          key={chunk.id}
                          className={`p-3 rounded-xl border transition-all text-left cursor-pointer ${
                            isRetrieved
                              ? "bg-indigo-50/50 border-indigo-400 shadow-sm"
                              : "bg-slate-50/50 border-slate-200 hover:bg-slate-50"
                          }`}
                          onClick={() => setSelectedChunkId(isInspected ? null : chunk.id)}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                isRetrieved ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"
                              }`}>
                                Chunk #{chunk.id}
                              </span>
                              <span className="text-[9px] text-slate-400 font-mono">
                                Start: {chunk.charStart}, End: {chunk.charEnd}
                              </span>
                            </div>

                            {chunk.similarity !== undefined && (
                              <span className={`text-xs font-mono font-bold ${isRetrieved ? "text-indigo-700" : "text-slate-500"}`}>
                                Match: {Math.round((chunk.similarity || 0) * 100)}% {isRetrieved && "⭐"}
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-700 font-mono line-clamp-2 mt-1">
                            "{chunk.text}"
                          </p>

                          {/* Detail expansion on user click */}
                          {isInspected && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              className="mt-2.5 pt-2.5 border-t border-slate-200 text-xs text-slate-600 space-y-2"
                            >
                              <p className="text-slate-800 font-medium">"{chunk.text}"</p>
                              
                              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                                <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1">
                                  8D Embedding Latent Space Vector Coordinates
                                </span>
                                <div className="grid grid-cols-4 gap-1 font-mono text-[10px] text-indigo-700">
                                  {chunk.vector.map((val, i) => (
                                    <div key={i} className="bg-slate-50 p-1 rounded border border-slate-100 flex items-center justify-between">
                                      <span className="text-[8px] text-slate-400">D{i+1}:</span>
                                      <strong>{val.toFixed(3)}</strong>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    // Simulating placeholders
                    <div className="space-y-2">
                      {[1, 2].map((id) => (
                        <div key={id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 animate-pulse space-y-2">
                          <div className="h-3 bg-slate-200 w-1/4 rounded" />
                          <div className="h-3.5 bg-slate-200 w-full rounded" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}

          </div>

          {/* RIGHT COLUMN: HIGHLY INTERACTIVE GROUNDED CONVERSATIONAL CHATBOT - spans 3 cols */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Sleek Sleek Chatbot Screen Emulator */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden flex flex-col h-[580px] relative">
              
              {/* Chat Header Screen Banner */}
              <div className="bg-slate-900 text-white p-4 flex items-center justify-between shadow-sm shrink-0">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-white" />
                    </div>
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-900" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white tracking-wide">RAG Grounded bot</h4>
                    <span className="text-[9px] text-emerald-400 font-mono flex items-center gap-0.5">
                      <Zap className="w-2.5 h-2.5 fill-current shrink-0" /> Local vector DB live
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleClearChat}
                    title="Clear Chat history log"
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <div className="text-[10px] bg-indigo-900 border border-indigo-700 px-1.5 py-0.5 rounded font-mono text-indigo-300">
                    K = {topK}
                  </div>
                </div>
              </div>

              {/* Chat Area Scroll panel */}
              <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-slate-50">
                {chatHistory.map((msg, index) => {
                  const isBot = msg.sender === "bot";
                  
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isBot ? "items-start" : "items-end"}`}
                    >
                      <div className="flex items-center gap-1 mb-1 text-[9px] text-slate-400">
                        {isBot ? (
                          <>
                            <Sparkles className="w-3 h-3 text-indigo-500" />
                            <span>RAG Grounded Agent</span>
                          </>
                        ) : (
                          <>
                            <span>You</span>
                            <User className="w-3 h-3 text-slate-500" />
                          </>
                        )}
                        <span>&bull; {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      {/* Chat text box */}
                      <div className={`p-3 rounded-2xl text-xs max-w-[94%] leading-relaxed shadow-sm ${
                        isBot 
                          ? "bg-white text-slate-800 border border-slate-200 rounded-tl-none font-medium" 
                          : "bg-indigo-600 text-white rounded-tr-none font-medium"
                      }`}>
                        {msg.isComputing ? (
                          <div className="flex items-center gap-2">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                            <span>Searching space coordinates...</span>
                          </div>
                        ) : (
                          <p className="whitespace-pre-line">{msg.text}</p>
                        )}
                      </div>

                      {/* EXCLUSIVE TELEMETRY DRAWER: RAG telemetry breakdown matching from complete data only! */}
                      {isBot && msg.ragResult && (
                        <div className="w-[94%] mt-1.5 bg-slate-100 p-2.5 rounded-xl border border-slate-200 text-[10px] text-slate-600 space-y-1.5">
                          <div className="flex items-center justify-between font-bold text-[9px] text-slate-600 uppercase tracking-wide border-b border-slate-200 pb-1">
                            <span className="flex items-center gap-1 text-indigo-600">
                              <Database className="w-3.5 h-3.5" /> Retrieved Facts Reranked
                            </span>
                            <span className="font-mono text-emerald-600">Sim matched</span>
                          </div>

                          <div className="space-y-1">
                            {msg.ragResult.topKChunks.map((c, i) => (
                              <div key={c.id} className="bg-white p-1.5 rounded border border-slate-200 text-[10px]">
                                <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold mb-0.5">
                                  <span>Chunk #{c.id}</span>
                                  <span className="text-indigo-600 font-mono">{Math.round((c.similarity || 0) * 100)}% similarity</span>
                                </div>
                                <p className="line-clamp-2 italic font-mono text-[9px]">"{c.text}"</p>
                              </div>
                            ))}
                          </div>

                          <span className="text-[8px] text-slate-400 block font-mono text-right">
                            * Guaranteed logic strictly prevents hallucinations.
                          </span>
                        </div>
                      )}

                      {/* GROUND-TRUTH MATCHING EVAL PANEL */}
                      {isBot && msg.ragResult && msg.ragResult.expectedAnswer && msg.ragResult.alignmentScore !== undefined && (
                        <div className="w-[94%] mt-1.5 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-200 text-[10px] text-slate-600 space-y-1.5 shadow-sm">
                          <div className="flex items-center justify-between border-b border-emerald-200/50 pb-1">
                            <span className="flex items-center gap-1 font-bold text-[9px] text-emerald-800 uppercase tracking-wider bg-emerald-100 px-1 py-0.2 rounded">
                              🎯 Ground-Truth Evaluation
                            </span>
                            <span className={`font-mono text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                              msg.ragResult.alignmentScore >= 80 
                                ? "bg-emerald-500 text-white" 
                                : msg.ragResult.alignmentScore >= 50 
                                ? "bg-amber-500 text-white" 
                                : "bg-rose-500 text-white"
                            }`}>
                              {msg.ragResult.alignmentScore}% Match
                            </span>
                          </div>

                          <div className="space-y-1">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[8px] font-bold text-slate-400 uppercase font-sans">Target Expected Answer:</span>
                              <p className="italic font-medium text-[9.5px] text-slate-600">"{msg.ragResult.expectedAnswer}"</p>
                            </div>

                            {/* Progress bar match score */}
                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden my-1">
                              <div 
                                className={`h-full transition-all duration-500 ${
                                  msg.ragResult.alignmentScore >= 80 
                                    ? "bg-emerald-500" 
                                    : msg.ragResult.alignmentScore >= 50 
                                    ? "bg-amber-500" 
                                    : "bg-rose-500"
                                }`}
                                style={{ width: `${msg.ragResult.alignmentScore}%` }}
                              />
                            </div>

                            {msg.ragResult.alignmentFeedback && (
                              <div className="flex flex-col gap-0.5 mt-1 text-slate-600">
                                <span className="text-[8px] font-bold text-indigo-500 uppercase font-sans">AI Verification Feedback:</span>
                                <p className="text-[9.5px] text-slate-600 leading-relaxed font-sans">{msg.ragResult.alignmentFeedback}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={chatBottomRef} />
              </div>

              {/* Optional Ground-truth Target Answer settings bar */}
              <div className="bg-slate-100/90 px-3 py-1.5 border-t border-slate-200 shrink-0 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-indigo-600" /> Target Expected Answer
                  </label>
                  <button
                    type="button"
                    onClick={() => setEnableExpectedEvaluation(!enableExpectedEvaluation)}
                    className={`text-[8px] font-bold px-1.5 py-0.5 rounded transition-all ${
                      enableExpectedEvaluation 
                        ? "bg-indigo-100 text-indigo-700 font-bold" 
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {enableExpectedEvaluation ? "Evaluation On" : "Evaluation Off"}
                  </button>
                </div>
                {enableExpectedEvaluation && (
                  <>
                    <input
                      type="text"
                      value={expectedAnswer}
                      onChange={(e) => setExpectedAnswer(e.target.value)}
                      placeholder="e.g. Products Team (PO, SM, and Developers)"
                      className="w-full bg-white border border-slate-200 rounded-lg text-[10px] py-1 px-2 focus:outline-indigo-500 font-medium text-slate-700"
                    />
                    {apiStatus && !apiStatus.hasApiKeyConfigured && (
                      <p className="text-[9px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200/50 leading-relaxed flex items-start gap-1">
                        <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <span>
                          <strong>Simulated Offline Mode</strong>: Intelligent semantic scoring is offline. Add your Gemini key to <strong>GEMINI_API_KEY</strong> in <strong>Settings &gt; Secrets</strong> to enable live AI reasoning and intelligent high-fidelity semantic match score calculations!
                        </span>
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Chat Form message Input bar */}
              <form onSubmit={handleChatSubmit} className="p-2 border-t border-slate-200 bg-white flex gap-2 shrink-0">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask me anything from the text..."
                  className="flex-1 bg-slate-50 hover:bg-slate-100/50 border border-slate-200 py-1.5 px-3 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600 placeholder:text-slate-400 font-medium"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 text-white disabled:text-slate-400 cursor-pointer shadow-sm transition-colors"
                >
                  <Send className="w-3.5 h-3.5 fill-current" />
                </button>
              </form>

            </div>

            {/* Quick Test Suggested Questions panel */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                👥 Suggested Test Questions
              </span>
              <div className="space-y-1.5">
                {[
                  "What is the primary benefit of RAG?",
                  "How do vector databases retrieve relevant items?",
                  "who are the attendees in sprint planning?",
                  "What are the characteristics of the Exosphere?"
                ].map((qLabel, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setChatInput(qLabel);
                    }}
                    className="w-full text-left text-xs text-slate-600 hover:text-indigo-700 hover:bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100 transition-all font-medium text-ellipsis overflow-hidden whitespace-nowrap block"
                  >
                    ✦ "{qLabel}"
                  </button>
                ))}
              </div>
            </div>

          </div>

        </div>

        {/* BOTTOM METRICS & EXPLAINER PANELS */}
        <section className="mt-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-600 animate-bounce" /> RAG Interactive Knowledge Base
            </h3>
            <span className="text-xs text-indigo-700 font-bold bg-indigo-50 px-2.5 py-1 rounded-full">Course Syllabus</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-150">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded bg-indigo-100 text-indigo-700 text-xs font-bold font-mono">STEP 1-2</span>
                <h4 className="font-bold text-sm text-slate-900">What is Chunking?</h4>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Large Language Models have fixed limit capacities called <strong>Context Windows</strong>. Because you cannot feed an entire 500-page book at once, we slice text into smaller segments termed chunks. Custom overlapping windows prevent cutting off critical context!
              </p>
            </div>

            <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-150">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded bg-cyan-100 text-cyan-800 text-xs font-bold font-mono">STEP 3-4</span>
                <h4 className="font-bold text-sm text-slate-900">What are Embeddings & DBs?</h4>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Embeddings translate subjective word sentences into fixed lists of numbers (dimensionality). These coordinates act as maps for concepts. Specialized <strong>Vector Databases</strong> index these coordinates to enable search speeds under milliseconds.
              </p>
            </div>

            <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-150">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded bg-emerald-100 text-emerald-800 text-xs font-bold font-mono">STEP 5-8</span>
                <h4 className="font-bold text-sm text-slate-900">Why RAG reduces hallucinations?</h4>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                By injecting factually matching source chunks into the temporary context window, we override general pre-training static weight weights. The system acts as an "Open Book Exam", restricting the model to literal retrieved truth factors only.
              </p>
            </div>

          </div>

          {/* Educational Sandbox Footer */}
          <div className="pt-4 border-t border-slate-150 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
            <span className="flex items-center gap-1.5">
              <Bookmark className="w-4 h-4 text-slate-400" /> Grounded AI Playground for Product Managers, Engineers, and Learners.
            </span>
            <span className="font-semibold text-slate-400">
              Active Server Gateway &bull; Host Environment Port 3000
            </span>
          </div>

        </section>

      </div>

    </div>
  );
}

/**
 * Visual assistant to render progress calculation times
 */
function countSimulationProgressTime(activeStep: number, speed: number): string {
  if (activeStep === -1) return "0ms";
  return `${(activeStep + 1) * speed}ms`;
}
