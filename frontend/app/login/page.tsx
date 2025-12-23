"use client";

import { useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    try {
      setError(null);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Login failed");
      }

      const token = await res.text();
      localStorage.setItem("token", token);

      window.location.href = "/conversations";
    } catch (e: any) {
      setError(e.message || "Login failed");
    }
  }

  async function handleRegister() {
    try {
      setError(null);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Register failed");
      }

      alert("Registered! Now log in.");
    } catch (e: any) {
      setError(e.message || "Register failed");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-sm space-y-4">
        <h1 className="text-xl font-bold text-center">Q-Messaging Login</h1>

        {error && <div className="text-red-600 text-sm">{error}</div>}

        <input
          className="border rounded w-full p-2"
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
        />

        <input
          className="border rounded w-full p-2"
          placeholder="Password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />

        <button
          className="w-full bg-blue-600 text-white py-2 rounded"
          onClick={handleLogin}
        >
          Login
        </button>

        <button
          className="w-full bg-gray-200 text-black py-2 rounded"
          onClick={handleRegister}
        >
          Register
        </button>
      </div>
    </div>
  );
}