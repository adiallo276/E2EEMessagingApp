"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function HomePage() {
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    setHasToken(!!localStorage.getItem("token"));
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-2xl border rounded-2xl p-8">
        <h1 className="text-3xl font-bold mb-3">Messaging</h1>
        <p className="text-gray-600 mb-6">
          Secure-ish messaging demo with Spring Boot + Next.js + WebSockets.
        </p>

        <div className="flex flex-wrap gap-3">
          {hasToken ? (
            <Link
              href="/conversations"
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              Open Conversations
            </Link>
          ) : (
            <Link
              href="/login"
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              Login
            </Link>
          )}

          <Link href="/register" className="border px-4 py-2 rounded">
            Create Account
          </Link>
        </div>

        <div className="mt-6 text-sm text-gray-500">
          Backend: <code>http://localhost:8080</code> • Frontend:{" "}
          <code>http://localhost:3000</code>
        </div>
      </div>
    </div>
  );
}