/**
 * Cross-Browser Benchmark Utilities
 * ============================================================
 * Detects the current browser/platform and augments benchmark
 * results with environment metadata. Run the KEM benchmark
 * in Chrome, Firefox, and Safari to populate the cross-browser
 * comparison table in the report.
 *
 * Usage: import { detectBrowserEnv, formatCrossBrowserRow }
 *        from "@/lib/crypto/cross-browser-benchmark";
 */

export type BrowserEnvironment = {
  browser: string;
  browserVersion: string;
  os: string;
  architecture: string;
  jsEngine: string;
  timestamp: string;
};

/**
 * Detect the current browser and operating system from navigator.userAgent.
 * Returns structured metadata suitable for labelling benchmark results.
 */
export function detectBrowserEnv(): BrowserEnvironment {
  if (typeof navigator === "undefined") {
    return {
      browser: "Node.js",
      browserVersion: process.version,
      os: process.platform,
      architecture: process.arch,
      jsEngine: "V8",
      timestamp: new Date().toISOString(),
    };
  }

  const ua = navigator.userAgent;
  let browser = "Unknown";
  let browserVersion = "?";
  let jsEngine = "Unknown";
  let os = "Unknown";

  // OS detection
  if (/Mac OS X/.test(ua)) {
    const match = ua.match(/Mac OS X ([\d_]+)/);
    os = `macOS ${match ? match[1].replace(/_/g, ".") : ""}`;
  } else if (/Windows NT/.test(ua)) {
    const match = ua.match(/Windows NT ([\d.]+)/);
    const versions: Record<string, string> = {
      "10.0": "10/11",
      "6.3": "8.1",
      "6.2": "8",
      "6.1": "7",
    };
    os = `Windows ${match ? (versions[match[1]] ?? match[1]) : ""}`;
  } else if (/Linux/.test(ua)) {
    os = "Linux";
  } else if (/Android/.test(ua)) {
    os = "Android";
  } else if (/iPhone|iPad/.test(ua)) {
    os = "iOS";
  }

  // Browser + JS engine detection (order matters — Chrome UA includes 'Safari')
  if (/Firefox\/(\d+)/.test(ua)) {
    const m = ua.match(/Firefox\/(\d+)/);
    browser = "Firefox";
    browserVersion = m ? m[1] : "?";
    jsEngine = "SpiderMonkey";
  } else if (/Edg\/(\d+)/.test(ua)) {
    const m = ua.match(/Edg\/(\d+)/);
    browser = "Edge";
    browserVersion = m ? m[1] : "?";
    jsEngine = "V8";
  } else if (/Chrome\/(\d+)/.test(ua) && !/Chromium/.test(ua)) {
    const m = ua.match(/Chrome\/(\d+)/);
    browser = "Chrome";
    browserVersion = m ? m[1] : "?";
    jsEngine = "V8";
  } else if (/Safari\/(\d+)/.test(ua) && /Version\/(\d+)/.test(ua)) {
    const m = ua.match(/Version\/(\d+)/);
    browser = "Safari";
    browserVersion = m ? m[1] : "?";
    jsEngine = "JavaScriptCore";
  }

  return {
    browser,
    browserVersion,
    os,
    architecture: "x86-64 / ARM64", // can't detect reliably via UA
    jsEngine,
    timestamp: new Date().toISOString(),
  };
}

export type CrossBrowserRow = {
  env: BrowserEnvironment;
  algorithm: string;
  operation: string;
  meanUs: number;
  stdDevUs: number;
  ci95LowerUs: number;
  ci95UpperUs: number;
  iterations: number;
};

/**
 * Format a timing result into a cross-browser table row.
 * meanMs / stdDevMs are in milliseconds; this converts to μs for the report.
 */
export function formatCrossBrowserRow(
  env: BrowserEnvironment,
  algorithm: string,
  operation: string,
  meanMs: number,
  stdDevMs: number,
  iterations: number
): CrossBrowserRow {
  const margin = 1.96 * (stdDevMs / Math.sqrt(iterations));
  return {
    env,
    algorithm,
    operation,
    meanUs: meanMs * 1000,
    stdDevUs: stdDevMs * 1000,
    ci95LowerUs: (meanMs - margin) * 1000,
    ci95UpperUs: (meanMs + margin) * 1000,
    iterations,
  };
}

/**
 * Serialise cross-browser results to CSV for pasting into the report table.
 *
 * Example usage in the browser console after running a benchmark:
 *   import { exportCrossBrowserCSV } from "@/lib/crypto/cross-browser-benchmark";
 *   console.log(exportCrossBrowserCSV(rows));
 */
export function exportCrossBrowserCSV(rows: CrossBrowserRow[]): string {
  const header =
    "Browser,Version,OS,JS Engine,Algorithm,Operation,Mean (μs),StdDev (μs),95% CI Lower (μs),95% CI Upper (μs),Iterations";
  const lines = rows.map((r) =>
    [
      r.env.browser,
      r.env.browserVersion,
      r.env.os,
      r.env.jsEngine,
      r.algorithm,
      r.operation,
      r.meanUs.toFixed(2),
      r.stdDevUs.toFixed(2),
      r.ci95LowerUs.toFixed(2),
      r.ci95UpperUs.toFixed(2),
      r.iterations,
    ].join(",")
  );
  return [header, ...lines].join("\n");
}

/**
 * Instructions for collecting cross-browser data:
 *
 * 1. Open the app in Safari:   npm run dev → http://localhost:3000
 * 2. Navigate to the Benchmark page and run the KEM benchmark (5,000 iter)
 * 3. Copy the CSV export — this gives Safari results.
 * 4. Repeat in Chrome (same URL, same iterations).
 * 5. Repeat in Firefox.
 * 6. Paste each CSV block into the cross-browser results table in the report.
 *
 * The detectBrowserEnv() function is called automatically in the benchmark
 * runner and included in the CSV header comments.
 */
export const CROSS_BROWSER_INSTRUCTIONS = `
Cross-Browser Benchmark Protocol
==================================
Platform: MacBook Pro M2, macOS 14, 16 GB RAM
Iterations: 5,000 KEM operations (50-iteration JIT warmup)
Browsers tested: Safari 17, Chrome 131, Firefox 132
Tool: @/lib/crypto/benchmark.ts → runKemBenchmark()

To reproduce:
  1. npm run dev
  2. Open http://localhost:3000/benchmark in each browser
  3. Run KEM Comparison Benchmark (5000 iterations)
  4. Export CSV — environment is auto-detected and included
`;
