"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { addMonths, endOfMonth, mondayIndex, monthTitle, startOfMonth, toISODate } from "@/lib/date"

type WorkoutRow = {
  id: string
  date: string // your DB column is "date"
  split_title?: string | null
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export default function CalendarMonth() {
  const router = useRouter()
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()))
  const [loading, setLoading] = useState(true)
  const [workoutDates, setWorkoutDates] = useState<Set<string>>(new Set())

  const grid = useMemo(() => {
    const start = startOfMonth(month)
    const end = endOfMonth(month)

    const leading = mondayIndex(start.getDay())
    const daysInMonth = end.getDate()

    const cells: Array<{ iso?: string; day?: number }> = []
    for (let i = 0; i < leading; i++) cells.push({})

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(month.getFullYear(), month.getMonth(), d)
      cells.push({ iso: toISODate(dateObj), day: d })
    }

    while (cells.length % 7 !== 0) cells.push({})
    return cells
  }, [month])

  useEffect(() => {
    ;(async () => {
      setLoading(true)

      const { data: userRes } = await supabase.auth.getUser()
      if (!userRes.user) {
        router.replace("/login")
        return
      }

      const startISO = toISODate(startOfMonth(month))
      const endISO = toISODate(endOfMonth(month))

      const { data, error } = await supabase
        .from("workouts")
        .select("id, date, split_title")
        .eq("user_id", userRes.user.id)
        .gte("date", startISO)
        .lte("date", endISO)

      if (error) {
        console.warn(error.message)
        setWorkoutDates(new Set())
        setLoading(false)
        return
      }

      const rows = (data ?? []) as WorkoutRow[]
      setWorkoutDates(new Set(rows.map((r) => r.date)))
      setLoading(false)
    })()
  }, [month, router])

  const todayISO = toISODate(new Date())

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-2xl">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setMonth((m) => addMonths(m, -1))}
          className="rounded-xl px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 transition"
        >
          ←
        </button>

        <div className="text-center">
          <div className="text-xl font-bold tracking-tight">{monthTitle(month)}</div>
          <div className="text-xs text-white/50 mt-1">{loading ? "Loading..." : "Click a day"}</div>
        </div>

        <button
          onClick={() => setMonth((m) => addMonths(m, 1))}
          className="rounded-xl px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 transition"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2 mt-5 text-xs text-white/60">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center py-2">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2 mt-2">
        {grid.map((c, idx) => {
          if (!c.iso) return <div key={idx} className="h-12 rounded-xl" />

          const isToday = c.iso === todayISO
          const hasWorkout = workoutDates.has(c.iso)

          return (
            <button
              key={c.iso}
              onClick={() => router.push(`/dashboard/${c.iso}`)}
              className={[
                "h-12 rounded-xl border text-sm font-semibold relative transition",
                "bg-[#06121c] border-white/10 hover:border-blue-400/50 hover:bg-[#071a28]",
                isToday ? "ring-2 ring-blue-500/40" : "",
                hasWorkout ? "ring-2 ring-emerald-400/25" : "",
              ].join(" ")}
            >
              <span className={isToday ? "text-blue-200" : "text-white"}>{c.day}</span>
              {hasWorkout && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-emerald-400/90" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
