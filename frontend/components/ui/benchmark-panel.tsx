"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  BenchmarkEvent,
  subscribeToBenchmarks,
  clearBenchmarks,
  getBenchmarkSummary,
  runKemBenchmark,
  BenchmarkResults,
  exportBenchmarksToCSV,
} from "@/lib/crypto/benchmark";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

type Tab = "events" | "summary" | "compare";

export default function BenchmarkPanel({ isOpen, onClose }: Props) {
  const [events, setEvents] = useState<BenchmarkEvent[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("events");
  const [benchmarkResults, setBenchmarkResults] = useState<BenchmarkResults | null>(null);
  const [isRunningBenchmark, setIsRunningBenchmark] = useState(false);
  const [iterations, setIterations] = useState(10);

  useEffect(() => {
    const unsubscribe = subscribeToBenchmarks((newEvents) => {
      setEvents(newEvents);
    });
    return unsubscribe;
  }, []);

  const runBenchmark = useCallback(async () => {
    setIsRunningBenchmark(true);
    try {
      const results = await runKemBenchmark(iterations);
      setBenchmarkResults(results);
    } catch (error) {
      console.error("Benchmark failed:", error);
    } finally {
      setIsRunningBenchmark(false);
    }
  }, [iterations]);

  const handleExport = useCallback(() => {
    const csv = exportBenchmarksToCSV(events, benchmarkResults);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pqc-benchmark-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [events, benchmarkResults]);

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
          Compare
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
                  min="1"
                  max="100"
                  value={iterations}
                  onChange={(e) => setIterations(Math.max(1, Math.min(100, parseInt(e.target.value) || 10)))}
                  className="w-16 px-2 py-1 text-xs border border-border rounded bg-background"
                />
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
              <p className="text-[10px] text-muted-foreground mt-2">
                Runs {iterations} iterations of KeyGen, Encapsulation, and Decapsulation for both Kyber and Frodo.
              </p>
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
      </div>
    </div>
  );
}
