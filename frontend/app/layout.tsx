import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { BenchmarkProvider } from "@/lib/benchmark-context";

// Modern, friendly sans-serif font
const inter = Inter({ 
  variable: "--font-geist-sans", 
  subsets: ["latin"],
  display: "swap",
});

// Clean mono font for code
const jetbrainsMono = JetBrains_Mono({ 
  variable: "--font-geist-mono", 
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Q-Messaging",
  description: "Post-Quantum Encrypted Messaging",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <ThemeProvider>
          <BenchmarkProvider>
            {children}
          </BenchmarkProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
