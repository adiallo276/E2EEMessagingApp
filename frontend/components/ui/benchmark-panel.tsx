"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  BenchmarkEvent,
  subscribeToBenchmarks,
  clearBenchmarks,
  getBenchmarkSummary,
  runKemBenchmark,
  runThroughputBenchmark,
  BenchmarkResults,
  ThroughputResults,
  BenchmarkProgress,
  exportBenchmarksToCSV,
} from "@/lib/crypto/benchmark";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

type Tab = "events" | "summary" | "compare" | "throughput";

export default function BenchmarkPanel({ isOpen, onClose }: Props) {
  const [events, setEvents] = useState<BenchmarkEvent[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("events");
  const [benchmarkResults, setBenchmarkResults] = useState<BenchmarkResults | null>(null);
  const [throughputResults, setThroughputResults] = useState<ThroughputResults | null>(null);
  const [isRunningBenchmark, setIsRunningBenchmark] = useState(false);
  const [iterations, setIterations] = useState(100);
  const [messagesPerSession, setMessagesPerSession] = useState(10);
  const [messageSizeKB, setMessageSizeKB] = useState(1);
  const [progress, setProgress] = useState<BenchmarkProgress | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToBenchmarks((newEvents) => {
      setEvents(newEvents);
    });
    return unsubscribe;
  }, []);

  const runBenchmark = useCallback(async () => {
    setIsRunningBenchmark(true);
    setProgress(null);
    try {
      const results = await runKemBenchmark(iterations, (p) => setProgress(p));
      setBenchmarkResults(results);
    } catch (error) {
      console.error("Benchmark failed:", error);
    } finally {
      setIsRunningBenchmark(false);
      setProgress(null);
    }
  }, [iterations]);

  const runThroughput = useCallback(async () => {
    setIsRunningBenchmark(true);
    setProgress(null);
    try {
      const results = await runThroughputBenchmark(
        iterations,
        messagesPerSession,
        messageSizeKB,
        (p) => setProgress(p)
      );
      setThroughputResults(results);
    } catch (error) {
      console.error("Throughput benchmark failed:", error);
    } finally {
      setIsRunningBenchmark(false);
      setProgress(null);
    }
  }, [iterations, messagesPerSession, messageSizeKB]);

  const handleExport = useCallback(() => {
    const csv = exportBenchmarksToCSV(events, benchmarkResults, throughputResults);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pqc-benchmark-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [events, benchmarkResults, throughputResults]);

  if (!isOpen) return null;

  const summary = getBenchmarkSummary();

  const formatDuration = (ms: number) => {
    if (ms < 0.001) return `${(ms * 1000000).toFixed(2)} ns`;
    if (ms < 1) return `${(ms * 1000).toFixed(2)} µs`;
    if (ms < 1000) return `${ms.toFixed(2)} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getEventColor = (type: BenchmarkEvent["type"]) => {
    switch (type) {
      case "keygen":
        return "bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30";
      case "encapsulate":
        return "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30";
      case "decapsulate":
        return "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/30";
      case "aes_encrypt":
        return "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
      case "aes_decrypt":
        return "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30";
      case "key_derive":
        return "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30";
      case "handshake_complete":
        return "bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getAlgorithmBadge = (alg: string) => {
    if (alg === "kyber") {
      return "bg-indigo-500/20 text-indigo-600 dark:text-indigo-400";
    } else if (alg === "frodo") {
      return "bg-orange-500/20 text-orange-600 dark:text-orange-400";
    } else if (alg === "ntru") {
      return "bg-purple-500/20 text-purple-600 dark:text-purple-400";
    } else if (alg === "AES-GCM") {
      return "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400";
    } else if (alg === "HKDF") {
      return "bg-amber-500/20 text-amber-600 dark:text-amber-400";
    }
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="w-96 border-l border-border bg-card flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div>
          <div className="font-medium text-sm">Benchmark Panel</div>
          <div className="text-xs text-muted-foreground">
            {events.length} events recorded
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExport}
            className="h-7 px-2 text-xs"
            title="Export to CSV"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" x2="12" y1="15" y2="3"/>
            </svg>
            Export
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => clearBenchmarks()}
            className="h-7 px-2 text-xs"
          >
            Clear
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-7 w-7 p-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
            </svg>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("events")}
          className={`flex-1 px-3 py-2 text-xs font-medium transition ${
            activeTab === "events"
              ? "text-foreground border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Events
        </button>
        <button
          onClick={() => setActiveTab("summary")}
          className={`flex-1 px-3 py-2 text-xs font-medium transition ${
            activeTab === "summary"
              ? "text-foreground border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Summary
        </button>
        <button
          onClick={() => setActiveTab("compare")}
          className={`flex-1 px-3 py-2 text-xs font-medium transition ${
            activeTab === "compare"
              ? "text-foreground border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          KEM
        </button>
        <button
          onClick={() => setActiveTab("throughput")}
          className={`flex-1 px-3 py-2 text-xs font-medium transition ${
            activeTab === "throughput"
              ? "text-foreground border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Throughput
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === "events" && (
          <div className="p-2 space-y-2">
            {events.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No events yet. Start an encrypted conversation to see benchmarks.
              </div>
            ) : (
              [...events].reverse().map((event) => (
                <div
                  key={event.id}
                  className={`rounded-lg border p-2.5 ${getEventColor(event.type)}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">
                        {event.operation}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${getAlgorithmBadge(event.algorithm)}`}>
                          {event.algorithm.toUpperCase()}
                        </span>
                        <span className="text-[10px] opacity-70">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold">
                        {formatDuration(event.durationMs)}
                      </div>
                    </div>
                  </div>

                  {(event.inputSize || event.outputSize || event.details) && (
                    <div className="mt-2 pt-2 border-t border-current/10 space-y-1">
                      {event.inputSize && (
                        <div className="text-[10px] flex justify-between">
                          <span className="opacity-70">Input size:</span>
                          <span className="font-mono">{formatSize(event.inputSize)}</span>
                        </div>
                      )}
                      {event.outputSize && (
                        <div className="text-[10px] flex justify-between">
                          <span className="opacity-70">Output size:</span>
                          <span className="font-mono">{formatSize(event.outputSize)}</span>
                        </div>
                      )}
                      {event.details && Object.entries(event.details).map(([key, value]) => (
                        <div key={key} className="text-[10px] flex justify-between">
                          <span className="opacity-70">{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}:</span>
                          <span className="font-mono">
                            {typeof value === "number" 
                              ? (key.toLowerCase().includes("ms") || key.toLowerCase().includes("time") 
                                ? formatDuration(value) 
                                : key.toLowerCase().includes("size") || key.toLowerCase().includes("length") || key.toLowerCase().includes("bytes")
                                  ? formatSize(value)
                                  : value)
                              : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "summary" && (
          <div className="p-3 space-y-4">
            {/* Averages from real usage */}
            <div>
              <div className="text-xs font-medium mb-2">Average Times (from usage)</div>
              <div className="space-y-2">
                {/* Kyber */}
                <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-2.5">
                  <div className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-2">
                    Kyber (Ring-LWE)
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <div>
                      <div className="text-muted-foreground">Key Gen</div>
                      <div className="font-mono font-medium">
                        {summary.averages.kyberKeygen 
                          ? formatDuration(summary.averages.kyberKeygen) 
                          : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Encap</div>
                      <div className="font-mono font-medium">
                        {summary.averages.kyberEncapsulate 
                          ? formatDuration(summary.averages.kyberEncapsulate) 
                          : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Decap</div>
                      <div className="font-mono font-medium">
                        {summary.averages.kyberDecapsulate 
                          ? formatDuration(summary.averages.kyberDecapsulate) 
                          : "—"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Frodo */}
                <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-2.5">
                  <div className="text-xs font-medium text-orange-600 dark:text-orange-400 mb-2">
                    Frodo (Standard LWE)
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <div>
                      <div className="text-muted-foreground">Key Gen</div>
                      <div className="font-mono font-medium">
                        {summary.averages.frodoKeygen 
                          ? formatDuration(summary.averages.frodoKeygen) 
                          : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Encap</div>
                      <div className="font-mono font-medium">
                        {summary.averages.frodoEncapsulate 
                          ? formatDuration(summary.averages.frodoEncapsulate) 
                          : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Decap</div>
                      <div className="font-mono font-medium">
                        {summary.averages.frodoDecapsulate 
                          ? formatDuration(summary.averages.frodoDecapsulate) 
                          : "—"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* NTRU */}
                <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-2.5">
                  <div className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-2">
                    NTRU (Polynomial Ring)
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <div>
                      <div className="text-muted-foreground">Key Gen</div>
                      <div className="font-mono font-medium">
                        {summary.averages.ntruKeygen 
                          ? formatDuration(summary.averages.ntruKeygen) 
                          : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Encap</div>
                      <div className="font-mono font-medium">
                        {summary.averages.ntruEncapsulate 
                          ? formatDuration(summary.averages.ntruEncapsulate) 
                          : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Decap</div>
                      <div className="font-mono font-medium">
                        {summary.averages.ntruDecapsulate 
                          ? formatDuration(summary.averages.ntruDecapsulate) 
                          : "—"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* AES */}
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5">
                  <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                    AES-256-GCM
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <div className="text-muted-foreground">Encrypt</div>
                      <div className="font-mono font-medium">
                        {summary.averages.aesEncrypt 
                          ? formatDuration(summary.averages.aesEncrypt) 
                          : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Decrypt</div>
                      <div className="font-mono font-medium">
                        {summary.averages.aesDecrypt 
                          ? formatDuration(summary.averages.aesDecrypt) 
                          : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Event counts */}
            <div>
              <div className="text-xs font-medium mb-2">Event Counts</div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="rounded border border-border p-2">
                  <div className="text-muted-foreground">Key Generations</div>
                  <div className="font-mono font-medium text-sm">{summary.keygenEvents.length}</div>
                </div>
                <div className="rounded border border-border p-2">
                  <div className="text-muted-foreground">Encapsulations</div>
                  <div className="font-mono font-medium text-sm">{summary.encapsulateEvents.length}</div>
                </div>
                <div className="rounded border border-border p-2">
                  <div className="text-muted-foreground">Decapsulations</div>
                  <div className="font-mono font-medium text-sm">{summary.decapsulateEvents.length}</div>
                </div>
                <div className="rounded border border-border p-2">
                  <div className="text-muted-foreground">Handshakes</div>
                  <div className="font-mono font-medium text-sm">{summary.handshakeEvents.length}</div>
                </div>
                <div className="rounded border border-border p-2">
                  <div className="text-muted-foreground">AES Encryptions</div>
                  <div className="font-mono font-medium text-sm">{summary.aesEncryptEvents.length}</div>
                </div>
                <div className="rounded border border-border p-2">
                  <div className="text-muted-foreground">AES Decryptions</div>
                  <div className="font-mono font-medium text-sm">{summary.aesDecryptEvents.length}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "compare" && (
          <div className="p-3 space-y-4">
            {/* Benchmark Controls */}
            <div className="rounded-lg border border-border p-3">
              <div className="text-xs font-medium mb-3">Run KEM Comparison Benchmark</div>
              <div className="flex items-center gap-2 mb-3">
                <label className="text-xs text-muted-foreground">Iterations:</label>
                <input
                  type="number"
                  min="10"
                  max="5000"
                  step="100"
                  value={iterations}
                  onChange={(e) => setIterations(Math.max(10, Math.min(5000, parseInt(e.target.value) || 100)))}
                  className="w-20 px-2 py-1 text-xs border border-border rounded bg-background"
                  disabled={isRunningBenchmark}
                />
              </div>
              
              {/* Quick select buttons */}
              <div className="flex gap-1 mb-3">
                {[100, 500, 1000, 5000].map((n) => (
                  <button
                    key={n}
                    onClick={() => setIterations(n)}
                    disabled={isRunningBenchmark}
                    className={`flex-1 px-2 py-1 text-[10px] rounded border transition ${
                      iterations === n
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {n >= 1000 ? `${n/1000}k` : n}
                  </button>
                ))}
              </div>
              
              <Button
                onClick={runBenchmark}
                disabled={isRunningBenchmark}
                className="w-full text-xs"
                size="sm"
              >
                {isRunningBenchmark ? (
                  <>
                    <svg className="h-3 w-3 mr-2 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Running...
                  </>
                ) : (
                  "Run Benchmark"
                )}
              </Button>
              
              {/* Progress bar */}
              {isRunningBenchmark && progress && (
                <div className="mt-3">
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>{progress.phase}</span>
                    <span>{progress.current}/{progress.total}</span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-150"
                      style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              
              <p className="text-[10px] text-muted-foreground mt-2">
                Runs {iterations} iterations of KeyGen, Encapsulation, and Decapsulation for both Kyber and Frodo.
                Includes warmup phase for JIT optimization.
              </p>
              
              <div className="mt-2 p-2 rounded bg-amber-500/10 border border-amber-500/20">
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  <strong>Note:</strong> These are simplified educational implementations. 
                  Real Kyber/Frodo libraries would show different performance characteristics.
                </p>
              </div>
            </div>

            {/* Results */}
            {benchmarkResults && (
              <>
                {/* Comparison Table */}
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="bg-muted/50 px-3 py-2 border-b border-border">
                    <div className="text-xs font-medium">Performance Comparison</div>
                    <div className="text-[10px] text-muted-foreground">
                      {benchmarkResults.iterations} iterations each
                    </div>
                  </div>
                  <div className="divide-y divide-border">
                    {/* Header */}
                    <div className="grid grid-cols-4 gap-2 px-3 py-2 bg-muted/30 text-[10px] font-medium">
                      <div>Operation</div>
                      <div className="text-right text-indigo-600 dark:text-indigo-400">Kyber</div>
                      <div className="text-right text-orange-600 dark:text-orange-400">Frodo</div>
                      <div className="text-right">Diff</div>
                    </div>
                    
                    {/* Key Generation */}
                    <div className="grid grid-cols-4 gap-2 px-3 py-2 text-[10px]">
                      <div className="font-medium">Key Gen (avg)</div>
                      <div className="text-right font-mono">{formatDuration(benchmarkResults.kyber.keyGen.avg)}</div>
                      <div className="text-right font-mono">{formatDuration(benchmarkResults.frodo.keyGen.avg)}</div>
                      <div className={`text-right font-mono ${benchmarkResults.kyber.keyGen.avg < benchmarkResults.frodo.keyGen.avg ? "text-green-600" : "text-red-600"}`}>
                        {((benchmarkResults.frodo.keyGen.avg / benchmarkResults.kyber.keyGen.avg - 1) * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 px-3 py-1 text-[10px] text-muted-foreground">
                      <div className="pl-2">± std dev</div>
                      <div className="text-right font-mono">±{formatDuration(benchmarkResults.kyber.keyGen.stdDev)}</div>
                      <div className="text-right font-mono">±{formatDuration(benchmarkResults.frodo.keyGen.stdDev)}</div>
                      <div></div>
                    </div>

                    {/* Encapsulation */}
                    <div className="grid grid-cols-4 gap-2 px-3 py-2 text-[10px]">
                      <div className="font-medium">Encap (avg)</div>
                      <div className="text-right font-mono">{formatDuration(benchmarkResults.kyber.encapsulate.avg)}</div>
                      <div className="text-right font-mono">{formatDuration(benchmarkResults.frodo.encapsulate.avg)}</div>
                      <div className={`text-right font-mono ${benchmarkResults.kyber.encapsulate.avg < benchmarkResults.frodo.encapsulate.avg ? "text-green-600" : "text-red-600"}`}>
                        {((benchmarkResults.frodo.encapsulate.avg / benchmarkResults.kyber.encapsulate.avg - 1) * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 px-3 py-1 text-[10px] text-muted-foreground">
                      <div className="pl-2">± std dev</div>
                      <div className="text-right font-mono">±{formatDuration(benchmarkResults.kyber.encapsulate.stdDev)}</div>
                      <div className="text-right font-mono">±{formatDuration(benchmarkResults.frodo.encapsulate.stdDev)}</div>
                      <div></div>
                    </div>

                    {/* Decapsulation */}
                    <div className="grid grid-cols-4 gap-2 px-3 py-2 text-[10px]">
                      <div className="font-medium">Decap (avg)</div>
                      <div className="text-right font-mono">{formatDuration(benchmarkResults.kyber.decapsulate.avg)}</div>
                      <div className="text-right font-mono">{formatDuration(benchmarkResults.frodo.decapsulate.avg)}</div>
                      <div className={`text-right font-mono ${benchmarkResults.kyber.decapsulate.avg < benchmarkResults.frodo.decapsulate.avg ? "text-green-600" : "text-red-600"}`}>
                        {((benchmarkResults.frodo.decapsulate.avg / benchmarkResults.kyber.decapsulate.avg - 1) * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 px-3 py-1 text-[10px] text-muted-foreground">
                      <div className="pl-2">± std dev</div>
                      <div className="text-right font-mono">±{formatDuration(benchmarkResults.kyber.decapsulate.stdDev)}</div>
                      <div className="text-right font-mono">±{formatDuration(benchmarkResults.frodo.decapsulate.stdDev)}</div>
                      <div></div>
                    </div>

                    {/* Total */}
                    <div className="grid grid-cols-4 gap-2 px-3 py-2 text-[10px] bg-muted/30">
                      <div className="font-bold">Total (avg)</div>
                      <div className="text-right font-mono font-bold">
                        {formatDuration(
                          benchmarkResults.kyber.keyGen.avg +
                          benchmarkResults.kyber.encapsulate.avg +
                          benchmarkResults.kyber.decapsulate.avg
                        )}
                      </div>
                      <div className="text-right font-mono font-bold">
                        {formatDuration(
                          benchmarkResults.frodo.keyGen.avg +
                          benchmarkResults.frodo.encapsulate.avg +
                          benchmarkResults.frodo.decapsulate.avg
                        )}
                      </div>
                      <div className={`text-right font-mono font-bold ${
                        (benchmarkResults.kyber.keyGen.avg + benchmarkResults.kyber.encapsulate.avg + benchmarkResults.kyber.decapsulate.avg) <
                        (benchmarkResults.frodo.keyGen.avg + benchmarkResults.frodo.encapsulate.avg + benchmarkResults.frodo.decapsulate.avg)
                          ? "text-green-600" : "text-red-600"
                      }`}>
                        {(((benchmarkResults.frodo.keyGen.avg + benchmarkResults.frodo.encapsulate.avg + benchmarkResults.frodo.decapsulate.avg) /
                          (benchmarkResults.kyber.keyGen.avg + benchmarkResults.kyber.encapsulate.avg + benchmarkResults.kyber.decapsulate.avg) - 1) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Key Sizes */}
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="bg-muted/50 px-3 py-2 border-b border-border">
                    <div className="text-xs font-medium">Key & Ciphertext Sizes</div>
                  </div>
                  <div className="divide-y divide-border">
                    <div className="grid grid-cols-3 gap-2 px-3 py-2 bg-muted/30 text-[10px] font-medium">
                      <div>Parameter</div>
                      <div className="text-right text-indigo-600 dark:text-indigo-400">Kyber</div>
                      <div className="text-right text-orange-600 dark:text-orange-400">Frodo</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 px-3 py-2 text-[10px]">
                      <div>Public Key</div>
                      <div className="text-right font-mono">{formatSize(benchmarkResults.kyber.sizes.publicKey)}</div>
                      <div className="text-right font-mono">{formatSize(benchmarkResults.frodo.sizes.publicKey)}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 px-3 py-2 text-[10px]">
                      <div>Secret Key</div>
                      <div className="text-right font-mono">{formatSize(benchmarkResults.kyber.sizes.secretKey)}</div>
                      <div className="text-right font-mono">{formatSize(benchmarkResults.frodo.sizes.secretKey)}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 px-3 py-2 text-[10px]">
                      <div>Ciphertext</div>
                      <div className="text-right font-mono">{formatSize(benchmarkResults.kyber.sizes.ciphertext)}</div>
                      <div className="text-right font-mono">{formatSize(benchmarkResults.frodo.sizes.ciphertext)}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 px-3 py-2 text-[10px]">
                      <div>Shared Secret</div>
                      <div className="text-right font-mono">{formatSize(benchmarkResults.kyber.sizes.sharedSecret)}</div>
                      <div className="text-right font-mono">{formatSize(benchmarkResults.frodo.sizes.sharedSecret)}</div>
                    </div>
                  </div>
                </div>

                {/* Min/Max */}
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="bg-muted/50 px-3 py-2 border-b border-border">
                    <div className="text-xs font-medium">Min/Max Times</div>
                  </div>
                  <div className="p-3 grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <div className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400">Kyber</div>
                      <div className="text-[10px] space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">KeyGen:</span>
                          <span className="font-mono">{formatDuration(benchmarkResults.kyber.keyGen.min)} - {formatDuration(benchmarkResults.kyber.keyGen.max)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Encap:</span>
                          <span className="font-mono">{formatDuration(benchmarkResults.kyber.encapsulate.min)} - {formatDuration(benchmarkResults.kyber.encapsulate.max)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Decap:</span>
                          <span className="font-mono">{formatDuration(benchmarkResults.kyber.decapsulate.min)} - {formatDuration(benchmarkResults.kyber.decapsulate.max)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-[10px] font-medium text-orange-600 dark:text-orange-400">Frodo</div>
                      <div className="text-[10px] space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">KeyGen:</span>
                          <span className="font-mono">{formatDuration(benchmarkResults.frodo.keyGen.min)} - {formatDuration(benchmarkResults.frodo.keyGen.max)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Encap:</span>
                          <span className="font-mono">{formatDuration(benchmarkResults.frodo.encapsulate.min)} - {formatDuration(benchmarkResults.frodo.encapsulate.max)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Decap:</span>
                          <span className="font-mono">{formatDuration(benchmarkResults.frodo.decapsulate.min)} - {formatDuration(benchmarkResults.frodo.decapsulate.max)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {!benchmarkResults && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Click "Run Benchmark" to compare Kyber vs Frodo performance.
              </div>
            )}
          </div>
        )}

        {activeTab === "throughput" && (
          <div className="p-3 space-y-4">
            {/* Throughput Benchmark Controls */}
            <div className="rounded-lg border border-border p-3">
              <div className="text-xs font-medium mb-3">Session Throughput Benchmark</div>
              <p className="text-[10px] text-muted-foreground mb-3">
                Simulates real messaging: Key Exchange + N encrypted messages.
                Compares Kyber, Frodo, and AES-only (pre-shared key).
              </p>
              
              <div className="space-y-2 mb-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground w-24">Sessions:</label>
                  <input
                    type="number"
                    min="10"
                    max="500"
                    value={iterations}
                    onChange={(e) => setIterations(Math.max(10, Math.min(500, parseInt(e.target.value) || 50)))}
                    className="w-20 px-2 py-1 text-xs border border-border rounded bg-background"
                    disabled={isRunningBenchmark}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground w-24">Msgs/session:</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={messagesPerSession}
                    onChange={(e) => setMessagesPerSession(Math.max(1, Math.min(100, parseInt(e.target.value) || 10)))}
                    className="w-20 px-2 py-1 text-xs border border-border rounded bg-background"
                    disabled={isRunningBenchmark}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground w-24">Msg size (KB):</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={messageSizeKB}
                    onChange={(e) => setMessageSizeKB(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                    className="w-20 px-2 py-1 text-xs border border-border rounded bg-background"
                    disabled={isRunningBenchmark}
                  />
                </div>
              </div>
              
              {/* Quick presets */}
              <div className="flex gap-1 mb-3">
                <button
                  onClick={() => { setIterations(50); setMessagesPerSession(10); setMessageSizeKB(1); }}
                  disabled={isRunningBenchmark}
                  className="flex-1 px-2 py-1 text-[10px] rounded border border-border hover:bg-muted"
                >
                  Quick
                </button>
                <button
                  onClick={() => { setIterations(100); setMessagesPerSession(20); setMessageSizeKB(5); }}
                  disabled={isRunningBenchmark}
                  className="flex-1 px-2 py-1 text-[10px] rounded border border-border hover:bg-muted"
                >
                  Normal
                </button>
                <button
                  onClick={() => { setIterations(200); setMessagesPerSession(50); setMessageSizeKB(10); }}
                  disabled={isRunningBenchmark}
                  className="flex-1 px-2 py-1 text-[10px] rounded border border-border hover:bg-muted"
                >
                  Heavy
                </button>
              </div>
              
              <Button
                onClick={runThroughput}
                disabled={isRunningBenchmark}
                className="w-full text-xs"
                size="sm"
              >
                {isRunningBenchmark ? (
                  <>
                    <svg className="h-3 w-3 mr-2 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Running...
                  </>
                ) : (
                  "Run Throughput Benchmark"
                )}
              </Button>
              
              {/* Progress bar */}
              {isRunningBenchmark && progress && (
                <div className="mt-3">
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>{progress.phase}</span>
                    <span>{progress.current}/{progress.total}</span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-150"
                      style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Throughput Results */}
            {throughputResults && (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-2 text-center">
                    <div className="text-[10px] text-muted-foreground">Kyber Total</div>
                    <div className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {formatDuration(throughputResults.kyber.totalSession.avg)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-2 text-center">
                    <div className="text-[10px] text-muted-foreground">Frodo Total</div>
                    <div className="text-sm font-mono font-bold text-orange-600 dark:text-orange-400">
                      {formatDuration(throughputResults.frodo.totalSession.avg)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-center">
                    <div className="text-[10px] text-muted-foreground">ECDH Total</div>
                    <div className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatDuration(throughputResults.ecdh.totalSession.avg)}
                    </div>
                  </div>
                </div>

                {/* Overhead Summary */}
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs font-medium mb-2">PQC Overhead vs Traditional ECDH</div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-muted-foreground">Kyber vs ECDH:</span>
                      <span className={`text-xs font-mono font-bold ${throughputResults.summary.kyberVsEcdhPercent > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                        {throughputResults.summary.kyberVsEcdhPercent > 0 ? '+' : ''}{throughputResults.summary.kyberVsEcdhPercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-muted-foreground">Frodo vs ECDH:</span>
                      <span className={`text-xs font-mono font-bold ${throughputResults.summary.frodoVsEcdhPercent > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                        {throughputResults.summary.frodoVsEcdhPercent > 0 ? '+' : ''}{throughputResults.summary.frodoVsEcdhPercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-t border-border pt-2">
                      <span className="text-[10px] text-muted-foreground">Frodo vs Kyber:</span>
                      <span className={`text-xs font-mono font-bold ${throughputResults.summary.kyberVsFrodoPercent > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {throughputResults.summary.kyberVsFrodoPercent > 0 ? '+' : ''}{throughputResults.summary.kyberVsFrodoPercent.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Detailed Breakdown */}
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="bg-muted/50 px-3 py-2 border-b border-border">
                    <div className="text-xs font-medium">Detailed Breakdown</div>
                    <div className="text-[10px] text-muted-foreground">
                      {throughputResults.iterations} sessions × {throughputResults.messagesPerSession} msgs × {formatSize(throughputResults.messageSize)}
                    </div>
                  </div>
                  <div className="divide-y divide-border">
                    <div className="grid grid-cols-4 gap-2 px-3 py-2 bg-muted/30 text-[10px] font-medium">
                      <div>Metric</div>
                      <div className="text-right text-indigo-600 dark:text-indigo-400">Kyber</div>
                      <div className="text-right text-orange-600 dark:text-orange-400">Frodo</div>
                      <div className="text-right text-emerald-600 dark:text-emerald-400">ECDH</div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 px-3 py-2 text-[10px]">
                      <div className="font-medium">Key Exchange</div>
                      <div className="text-right font-mono">{formatDuration(throughputResults.kyber.keyExchange.avg)}</div>
                      <div className="text-right font-mono">{formatDuration(throughputResults.frodo.keyExchange.avg)}</div>
                      <div className="text-right font-mono">{formatDuration(throughputResults.ecdh.keyExchange.avg)}</div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 px-3 py-2 text-[10px]">
                      <div className="font-medium">Encrypt (per msg)</div>
                      <div className="text-right font-mono">{formatDuration(throughputResults.kyber.messageEncrypt.avg)}</div>
                      <div className="text-right font-mono">{formatDuration(throughputResults.frodo.messageEncrypt.avg)}</div>
                      <div className="text-right font-mono">{formatDuration(throughputResults.ecdh.messageEncrypt.avg)}</div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 px-3 py-2 text-[10px]">
                      <div className="font-medium">Decrypt (per msg)</div>
                      <div className="text-right font-mono">{formatDuration(throughputResults.kyber.messageDecrypt.avg)}</div>
                      <div className="text-right font-mono">{formatDuration(throughputResults.frodo.messageDecrypt.avg)}</div>
                      <div className="text-right font-mono">{formatDuration(throughputResults.ecdh.messageDecrypt.avg)}</div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 px-3 py-2 text-[10px] bg-muted/30 font-bold">
                      <div>Total Session</div>
                      <div className="text-right font-mono">{formatDuration(throughputResults.kyber.totalSession.avg)}</div>
                      <div className="text-right font-mono">{formatDuration(throughputResults.frodo.totalSession.avg)}</div>
                      <div className="text-right font-mono">{formatDuration(throughputResults.ecdh.totalSession.avg)}</div>
                    </div>
                  </div>
                </div>

                {/* Interpretation */}
                <div className="rounded-lg border border-border p-3 bg-muted/30">
                  <div className="text-xs font-medium mb-2">📊 Interpretation</div>
                  <p className="text-[10px] text-muted-foreground">
                    The PQC overhead is primarily in the <strong>key exchange phase</strong>. 
                    Once keys are established, message encryption (AES-GCM) is identical across all scenarios.
                    <br/><br/>
                    Compared to traditional ECDH (P-256):
                    <br/>• Kyber adds <strong>{throughputResults.summary.kyberVsEcdhPercent > 0 ? '+' : ''}{throughputResults.summary.kyberVsEcdhPercent.toFixed(1)}%</strong> overhead
                    <br/>• Frodo adds <strong>{throughputResults.summary.frodoVsEcdhPercent > 0 ? '+' : ''}{throughputResults.summary.frodoVsEcdhPercent.toFixed(1)}%</strong> overhead
                    <br/><br/>
                    <strong>Conclusion:</strong> {throughputResults.summary.kyberVsFrodoPercent > 0 
                      ? `Kyber is ${Math.abs(throughputResults.summary.kyberVsFrodoPercent).toFixed(1)}% faster than Frodo.`
                      : `Frodo is ${Math.abs(throughputResults.summary.kyberVsFrodoPercent).toFixed(1)}% faster than Kyber.`}
                    {' '}Both PQC algorithms provide quantum resistance at the cost of {Math.min(Math.abs(throughputResults.summary.kyberVsEcdhPercent), Math.abs(throughputResults.summary.frodoVsEcdhPercent)).toFixed(0)}-{Math.max(Math.abs(throughputResults.summary.kyberVsEcdhPercent), Math.abs(throughputResults.summary.frodoVsEcdhPercent)).toFixed(0)}% performance overhead vs traditional ECDH.
                  </p>
                </div>
              </>
            )}

            {!throughputResults && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Click "Run Throughput Benchmark" to compare real-world session performance.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
