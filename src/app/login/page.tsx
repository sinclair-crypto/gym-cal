"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { getEmailForIdentifier } from "@/lib/auth"

export default function LoginPage() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const canSubmit = identifier.trim().length > 0 && password.length > 0 && !loading

  async function onLogin() {
    if (!canSubmit) return
    setLoading(true)

    const email = await getEmailForIdentifier(identifier)
    if (!email) {
      setLoading(false)
      alert("Username not found. Try using your email.")
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (error) return alert(error.message)
    router.push("/dashboard")
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-extrabold tracking-tight">Gym Cal</h1>
          <p className="text-white/70 mt-2">
            Track workouts, progress, and stats — day by day.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-md p-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm text-white/70">Username or Email</label>
              <input
                className="mt-2 w-full rounded-xl bg-[#06121c] border border-white/10 px-4 py-3 text-white placeholder:text-white/40 outline-none
                           focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/20"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="andri_01 or you@example.com"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="text-sm text-white/70">Password</label>
              <input
                type="password"
                className="mt-2 w-full rounded-xl bg-[#06121c] border border-white/10 px-4 py-3 text-white placeholder:text-white/40 outline-none
                           focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/20"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            <button
              onClick={onLogin}
              disabled={!canSubmit}
              className="w-full rounded-xl py-3 font-semibold bg-blue-600 hover:bg-blue-700 transition
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Enter"}
            </button>

            <div className="text-center text-sm text-white/70">
              Don’t have an account?{" "}
              <button
                className="text-blue-400 hover:text-blue-300 font-semibold"
                onClick={() => router.push("/signup")}
              >
                Sign up
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-white/40 mt-6">
          Secure cloud storage • Templates • Calendar tracking
        </p>
      </div>
    </div>
  )
}
