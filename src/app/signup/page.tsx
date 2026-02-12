"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

export default function SignupPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const canSubmit =
    username.trim().length >= 3 &&
    email.trim().includes("@") &&
    password.length >= 6 &&
    !loading

  async function onSignup() {
    if (!canSubmit) return
    setLoading(true)

    const normalizedEmail = email.trim().toLowerCase()

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
    })

    if (error || !data.user) {
      setLoading(false)
      alert(error?.message ?? "Signup failed")
      return
    }

    // Trigger creates profile row; we update fields
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ username: username.trim(), email: normalizedEmail })
      .eq("id", data.user.id)

    setLoading(false)

    if (updateErr) console.warn(updateErr.message)
    router.push("/dashboard")
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight">Create Account</h1>
          <p className="text-white/70 mt-2">
            Save workouts, templates, and history across devices.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-md p-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm text-white/70">Username</label>
              <input
                className="mt-2 w-full rounded-xl bg-[#06121c] border border-white/10 px-4 py-3 text-white placeholder:text-white/40 outline-none
                           focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/20"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="andri_01"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="text-sm text-white/70">Email</label>
              <input
                className="mt-2 w-full rounded-xl bg-[#06121c] border border-white/10 px-4 py-3 text-white placeholder:text-white/40 outline-none
                           focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/20"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
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
                placeholder="min 6 characters"
                autoComplete="new-password"
              />
              <p className="text-xs text-white/40 mt-2">
                Tip: use a strong password — you’ll keep long-term progress here.
              </p>
            </div>

            <button
              onClick={onSignup}
              disabled={!canSubmit}
              className="w-full rounded-xl py-3 font-semibold bg-blue-600 hover:bg-blue-700 transition
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating..." : "Create Account"}
            </button>

            <div className="text-center text-sm text-white/70">
              Already have an account?{" "}
              <button
                className="text-blue-400 hover:text-blue-300 font-semibold"
                onClick={() => router.push("/login")}
              >
                Log in
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-white/40 mt-6">
          Gym Cal • Modern progress tracking
        </p>
      </div>
    </div>
  )
}
