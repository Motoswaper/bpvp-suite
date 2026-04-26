"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    if (!res.ok) {
      setError("Invalid credentials");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#05070f]">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-xl border border-slate-800 bg-[#101523] p-6">
        <h1 className="text-xl font-semibold">AXE Dashboard Login</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Dashboard password"
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
        />
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <button type="submit" className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500">
          Sign in
        </button>
      </form>
    </main>
  );
}
