"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import CalendarMonth from "@/components/CalendarMonth"

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.replace("/login")
        return
      }
      setEmail(data.user.email ?? null)
      setLoading(false)
    })()
  }, [router])

  async function logout() {
    await supabase.auth.signOut()
    router.replace("/login")
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-white/80">Loading...</div>
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gym Cal</h1>
            <p className="text-white/60 mt-1">Signed in as {email ?? "Unknown"}</p>
          </div>

          <div className="flex items-center gap-2">
  <button
    onClick={() => router.push("/templates")}
    className="rounded-xl px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 transition"
  >
    Templates
  </button>

  <button
    onClick={logout}
    className="rounded-xl px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 transition"
  >
    Logout
  </button>
</div>

        </div>

        <div className="mt-6">
          <CalendarMonth />
        </div>
      </div>
    </div>
  )
}
