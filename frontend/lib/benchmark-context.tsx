"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

export type MetricEntry = {
  id: string;
  timestamp: number;
  operation: string;
  algorithm: "kyber" | "frodo";
  phase: "keygen" | "encapsulate" | "decapsulate" | "aes-encrypt" | "aes-decrypt" | "handshake" | "message";
  durationMs: number;
  inputSize?: number;
  outputSize?: number;
  details?: Record<string, any>;
};

export type HandshakeMetrics = {
  algorithm: "kyber" | "frodo";
  keyGenTimeMs: number;
  encapsulateTimeMs: number;
  decapsulateTimeMs: number;
  totalTimeMs: number;
  publicKeySize: number;
  ciphertextSize: number;
  sharedSecretSize: number;
};

export type MessageMetrics = {
  algorithm: "kyber" | "frodo";
  direction: "encrypt" | "decrypt";
  aesTimeMs: number;
  plaintextSize: number;
  ciphertextSize: number;
  overhead: number; // percentage
};

type BenchmarkContextType = {
  entries: MetricEntry[];
  handshakeMetrics: HandshakeMetrics | null;
  lastMessageMetrics: MessageMetrics | null;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  addEntry: (entry: Omit<MetricEntry, "id" | "timestamp">) => void;
  setHandshakeMetrics: (metrics: HandshakeMetrics) => void;
  setLastMessageMetrics: (metrics: MessageMetrics) => void;
  clearEntries: () => void;
};

const BenchmarkContext = createContext<BenchmarkContextType | null>(null);

export function BenchmarkProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<MetricEntry[]>([]);
  const [handshakeMetrics, setHandshakeMetrics] = useState<HandshakeMetrics | null>(null);
  const [lastMessageMetrics, setLastMessageMetrics] = useState<MessageMetrics | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const addEntry = useCallback((entry: Omit<MetricEntry, "id" | "timestamp">) => {
    const newEntry: MetricEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    setEntries((prev) => [...prev.slice(-49), newEntry]); // Keep last 50 entries
  }, []);

  const clearEntries = useCallback(() => {
    setEntries([]);
    setHandshakeMetrics(null);
    setLastMessageMetrics(null);
  }, []);

  return (
    <BenchmarkContext.Provider
      value={{
        entries,
        handshakeMetrics,
        lastMessageMetrics,
        isOpen,
        setIsOpen,
        addEntry,
        setHandshakeMetrics,
        setLastMessageMetrics,
        clearEntries,
      }}
    >
      {children}
    </BenchmarkContext.Provider>
  );
}

export function useBenchmark() {
  const context = useContext(BenchmarkContext);
  if (!context) {
    throw new Error("useBenchmark must be used within a BenchmarkProvider");
  }
  return context;
}

// Utility to measure execution time
export async function measureTime<T>(
  fn: () => Promise<T>
): Promise<{ result: T; durationMs: number }> {
  const start = performance.now();
  const result = await fn();
  const durationMs = performance.now() - start;
  return { result, durationMs };
}
