"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
        setError("PIN must be exactly 6 digits");
        setLoading(false);
        return;
      }

      if (mode === "signup") {
        if (!name.trim()) {
          setError("Name is required");
          setLoading(false);
          return;
        }
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password: pin,
          options: { data: { full_name: name } },
        });
        if (signUpError) throw signUpError;
        setMode("signin");
        setError("");
        setSuccess("Account created! Please sign in with your email and PIN.");
        setName("");
        setPin("");
      } else {
        const { data, error: signInError } =
          await supabase.auth.signInWithPassword({
            email,
            password: pin,
          });
        if (signInError) throw signInError;
        if (data.session) router.push("/dashboards");
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-900 mb-2">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-slate-900">
              CSV Dashboard Builder
            </h1>
            <p className="text-sm text-slate-500">
              {mode === "signin"
                ? "Sign in with your email and PIN"
                : "Create an account with email and PIN"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="mt-1 w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                />
              </div>
            )}

            <div>
              <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1 w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                6-Digit PIN
              </label>
              <input
                type="password"
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="Enter 6-digit PIN"
                maxLength={6}
                inputMode="numeric"
                className="mt-1 w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 tracking-[0.5em] text-center"
              />
              <p className="text-xs text-slate-400 mt-1">
                {mode === "signup"
                  ? "Choose any 6-digit PIN you'll remember"
                  : "Enter the 6-digit PIN you chose at signup"}
              </p>
            </div>

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                {success}
              </div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || pin.length !== 6}
              className="w-full px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {loading
                ? "Please wait..."
                : mode === "signin"
                ? "Sign In"
                : "Create Account"}
            </button>
          </form>

          <div className="text-center">
            <button
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError("");
                setSuccess("");
              }}
              className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
            >
              {mode === "signin"
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
