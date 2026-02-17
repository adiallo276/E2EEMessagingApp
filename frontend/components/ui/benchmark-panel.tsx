"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  BenchmarkEvent,
  subscribeToBenchmarks,
  clearBenchmarks,
  getBenchmarkSummary,
} from "@/lib/crypto/benchmark";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function BenchmarkPanel({ isOpen, onClose }: Props) {
  const [events, setEvents] = useState<BenchmarkEvent[]>([]);
  const [activeTab, setActiveTab] = useState<"events" | "summary">("events");

  useEffect(() => {
    const unsubscribe = subscribeToBenchmarks((newEvents) => {
      setEvents(newEvents);
    });
    return unsubscribe;
  }, []);

  if (!isOpen) return null;

  const summary = getBenchmarkSummary();

  const formatDuration = (ms: number) => {
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
    <div className="w-80 border-l border-border bg-card flex flex-col h-full">
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
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === "events" ? (
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

                  {/* Details */}
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
        ) : (
          <div className="p-3 space-y-4">
            {/* Averages */}
            <div>
              <div className="text-xs font-medium mb-2">Average Times</div>
              <div className="space-y-2">
                {/* Kyber */}
                <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-2.5">
                  <div className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-2">
                    Kyber (Ring-LWE)
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <div className="text-muted-foreground">Key Gen</div>
                      <div className="font-mono font-medium">
                        {summary.averages.kyberKeygen 
                          ? formatDuration(summary.averages.kyberKeygen) 
                          : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Encapsulate</div>
                      <div className="font-mono font-medium">
                        {summary.averages.kyberEncapsulate 
                          ? formatDuration(summary.averages.kyberEncapsulate) 
                          : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Decapsulate</div>
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
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <div className="text-muted-foreground">Key Gen</div>
                      <div className="font-mono font-medium">
                        {summary.averages.frodoKeygen 
                          ? formatDuration(summary.averages.frodoKeygen) 
                          : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Encapsulate</div>
                      <div className="font-mono font-medium">
                        {summary.averages.frodoEncapsulate 
                          ? formatDuration(summary.averages.frodoEncapsulate) 
                          : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Decapsulate</div>
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
      </div>
    </div>
  );
}
