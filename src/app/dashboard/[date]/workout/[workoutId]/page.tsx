"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

type WorkoutRow = {
  id: string
  user_id: string
  date: string
  split_title: string | null
  created_at: string
}

type ExerciseRow = {
  id: string
  workout_id: string
  exercise_name: string
  category: string
  sets: number
  reps: number[]
  weight: number[]
  created_at: string
}

const CATEGORY_OPTIONS = ["Lifting", "Cardio"] as const

export default function WorkoutDetailPage() {
  const router = useRouter()
  const params = useParams<{ date: string; workoutId: string }>()

  const iso = params?.date || ""
  const workoutId = params?.workoutId || ""

  const [loading, setLoading] = useState(true)
  const [workout, setWorkout] = useState<WorkoutRow | null>(null)
  const [exercises, setExercises] = useState<ExerciseRow[]>([])

  // Add exercise modal
  const [open, setOpen] = useState(false)
  const [category, setCategory] =
    useState<(typeof CATEGORY_OPTIONS)[number]>("Lifting")
  const [exerciseName, setExerciseName] = useState("")
  const [sets, setSets] = useState(3)
  const [reps, setReps] = useState<number[]>([12, 10, 8])
  const [weight, setWeight] = useState<number[]>([0, 0, 0])
  const [saving, setSaving] = useState(false)

  // Menu (⋯)
  const [menuOpen, setMenuOpen] = useState(false)
  const [templateSaving, setTemplateSaving] = useState(false)
  const [deletingWorkout, setDeletingWorkout] = useState(false)

  const pretty = useMemo(() => {
    if (!iso) return ""
    const [y, m, d] = iso.split("-").map(Number)
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1)
    return dt.toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  }, [iso])

  function syncArrays(newSets: number) {
    const nextReps = Array.from({ length: newSets }, (_, i) => reps[i] ?? 0)
    const nextWeight = Array.from({ length: newSets }, (_, i) => weight[i] ?? 0)
    setReps(nextReps)
    setWeight(nextWeight)
  }

  async function requireUser() {
    const { data } = await supabase.auth.getUser()
    if (!data.user) {
      router.replace("/login")
      return null
    }
    return data.user
  }

  async function loadAll() {
    if (!workoutId) return
    setLoading(true)

    const user = await requireUser()
    if (!user) return

    // Load workout (must belong to this user)
    const w = await supabase
      .from("workouts")
      .select("id, user_id, date, split_title, created_at")
      .eq("id", workoutId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (w.error || !w.data) {
      setWorkout(null)
      setExercises([])
      setLoading(false)
      return
    }

    setWorkout(w.data as WorkoutRow)

    // Load exercises
    const e = await supabase
      .from("exercises")
      .select(
        "id, workout_id, exercise_name, category, sets, reps, weight, created_at"
      )
      .eq("workout_id", workoutId)
      .order("created_at", { ascending: true })

    if (e.error) {
      console.warn(e.error.message)
      setExercises([])
      setLoading(false)
      return
    }

    const rows = (e.data ?? []).map((r: any) => ({
      ...r,
      reps: Array.isArray(r.reps) ? r.reps : [],
      weight: Array.isArray(r.weight) ? r.weight : [],
    }))

    setExercises(rows as ExerciseRow[])
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutId])

  async function saveExercise() {
    if (!workout) return

    const name = exerciseName.trim()
    if (!name) return alert("Enter an exercise name.")
    if (sets < 1 || sets > 24) return alert("Sets must be 1–24.")
    if (reps.length !== sets || weight.length !== sets)
      return alert("Fix sets inputs.")

    setSaving(true)
    const { error } = await supabase.from("exercises").insert({
      workout_id: workout.id,
      exercise_name: name,
      category,
      sets,
      reps,
      weight,
    })
    setSaving(false)

    if (error) return alert(error.message)

    // Reset form
    setExerciseName("")
    setCategory("Lifting")
    setSets(3)
    setReps([12, 10, 8])
    setWeight([0, 0, 0])
    setOpen(false)

    loadAll()
  }

  async function deleteExercise(exerciseId: string) {
    const ok = confirm("Delete this exercise?")
    if (!ok) return

    const res = await supabase.from("exercises").delete().eq("id", exerciseId)
    if (res.error) return alert(res.error.message)

    setExercises((prev) => prev.filter((e) => e.id !== exerciseId))
  }

  async function deleteWorkout() {
    if (!workoutId) return
    const ok = confirm(
      "Delete this workout and ALL its exercises? This cannot be undone."
    )
    if (!ok) return

    setDeletingWorkout(true)

    // If you do NOT have ON DELETE CASCADE on exercises.workout_id FK, we delete exercises first:
    const delEx = await supabase.from("exercises").delete().eq("workout_id", workoutId)
    if (delEx.error) {
      setDeletingWorkout(false)
      return alert(delEx.error.message)
    }

    const delW = await supabase.from("workouts").delete().eq("id", workoutId)
    setDeletingWorkout(false)

    if (delW.error) return alert(delW.error.message)

    router.push(`/dashboard/${iso}`)
  }

  async function saveAsTemplate() {
    if (!workout) return

    setTemplateSaving(true)
    const user = await requireUser()
    if (!user) return

    // max 10 templates
    const countRes = await supabase
      .from("templates")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)

    const total = countRes.count ?? 0
    if (total >= 10) {
      setTemplateSaving(false)
      alert("Template limit reached (10). Delete one before saving a new template.")
      return
    }

    const templateName = (workout.split_title?.trim() || "Untitled Split").slice(
      0,
      60
    )

    // Create template
    const tplRes = await supabase
      .from("templates")
      .insert({ user_id: user.id, name: templateName })
      .select("id")
      .single()

    if (tplRes.error) {
      setTemplateSaving(false)
      alert(tplRes.error.message)
      return
    }

    const templateId = tplRes.data.id as string

    // Copy exercises
    const exRes = await supabase
      .from("exercises")
      .select("exercise_name, category, sets, reps, weight")
      .eq("workout_id", workoutId)
      .order("created_at", { ascending: true })

    if (exRes.error) {
      setTemplateSaving(false)
      alert(exRes.error.message)
      return
    }

    const exList = exRes.data ?? []

    if (exList.length > 0) {
      const rows = exList.map((ex: any) => ({
        template_id: templateId,
        user_id: user.id, // keep if your RLS requires it
        exercise_name: ex.exercise_name,
        category: ex.category,
        sets: ex.sets,
        reps: Array.isArray(ex.reps) ? ex.reps : [],
        weight: Array.isArray(ex.weight) ? ex.weight : [],
      }))

      const ins = await supabase.from("template_exercises").insert(rows)
      if (ins.error) {
        setTemplateSaving(false)
        alert(ins.error.message)
        return
      }
    }

    setTemplateSaving(false)
    setMenuOpen(false)
    alert(`Saved template: "${templateName}" (${exList.length} exercises)`)
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Top bar */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              onClick={() => router.push(`/dashboard/${iso}`)}
              className="rounded-xl px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 transition"
            >
              ← Back
            </button>

            <div>
              <div className="text-white/60 text-sm">{pretty}</div>
              <h1 className="text-2xl font-bold">
                {workout?.split_title ?? "Workout"}
              </h1>
              <div className="text-white/50 text-xs mt-1">
                Workout ID: {workoutId}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="rounded-xl px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 transition"
                aria-label="Workout menu"
              >
                ⋯
              </button>

              {menuOpen && (
                <button
                  className="fixed inset-0 cursor-default"
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close menu"
                />
              )}

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-white/10 bg-[#081a28] shadow-2xl p-2 z-50">
                  <button
                    onClick={saveAsTemplate}
                    disabled={templateSaving}
                    className="w-full text-left rounded-xl px-3 py-2 hover:bg-white/10 transition text-white/90 disabled:opacity-50"
                  >
                    {templateSaving ? "Saving..." : "Save as Template"}
                  </button>

                  <button
                    onClick={deleteWorkout}
                    disabled={deletingWorkout}
                    className="w-full text-left rounded-xl px-3 py-2 hover:bg-red-500/20 transition text-white/90 disabled:opacity-50"
                  >
                    {deletingWorkout ? "Deleting..." : "Delete Workout"}
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setOpen(true)}
              className="rounded-xl px-4 py-2 bg-blue-600 hover:bg-blue-700 transition font-semibold"
            >
              Add Exercise
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          {loading ? (
            <div className="text-white/70">Loading...</div>
          ) : !workout ? (
            <div className="text-white/70">
              Workout not found (or you don’t have access).
            </div>
          ) : exercises.length === 0 ? (
            <div className="text-white/60">No exercises yet. Add one.</div>
          ) : (
            <div className="space-y-3">
              {exercises.map((ex) => (
                <div
                  key={ex.id}
                  className="rounded-xl bg-[#06121c] border border-white/10 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{ex.exercise_name}</div>
                      <div className="text-xs text-white/60">{ex.category}</div>
                    </div>

                    <button
                      onClick={() => deleteExercise(ex.id)}
                      className="rounded-xl px-3 py-2 bg-white/5 border border-white/10 hover:bg-red-500/20 transition text-sm text-white/80"
                    >
                      Delete
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {Array.from({ length: ex.sets }, (_, i) => (
                      <div
                        key={i}
                        className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm"
                      >
                        <span className="text-white/60">Set {i + 1}:</span>{" "}
                        <span className="text-white">
                          {ex.reps?.[i] ?? "-"} reps @ {ex.weight?.[i] ?? "-"}kg
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Exercise Modal */}
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => !saving && setOpen(false)}
            />

            <div className="relative w-full max-w-xl rounded-2xl border border-white/10 bg-[#081a28] shadow-2xl p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Add Exercise</h2>
                <button
                  onClick={() => !saving && setOpen(false)}
                  className="rounded-xl px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 transition"
                >
                  ← Back
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="text-sm text-white/70">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="mt-2 w-full rounded-xl bg-[#06121c] border border-white/10 px-4 py-3 text-white outline-none focus:border-blue-400/60"
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm text-white/70">Exercise name</label>
                  <input
                    value={exerciseName}
                    onChange={(e) => setExerciseName(e.target.value)}
                    placeholder="e.g. Bench Press"
                    className="mt-2 w-full rounded-xl bg-[#06121c] border border-white/10 px-4 py-3 text-white outline-none focus:border-blue-400/60"
                  />
                </div>

                <div>
                  <label className="text-sm text-white/70">Sets (1–24)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={24}
                    value={sets}
                    onChange={(e) => {
                      const n = Math.max(1, Math.min(24, Number(e.target.value || 1)))
                      setSets(n)
                      syncArrays(n)
                    }}
                    className="mt-2 w-full rounded-xl bg-[#06121c] border border-white/10 px-4 py-3 text-white outline-none focus:border-blue-400/60"
                  />
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm font-semibold">Sets details</div>
                  <div className="text-xs text-white/60 mt-1">
                    Reps + Weight per set
                  </div>

                  <div className="mt-3 space-y-2 max-h-64 overflow-auto pr-1">
                    {Array.from({ length: sets }, (_, i) => (
                      <div key={i} className="grid grid-cols-3 gap-2 items-center">
                        <div className="text-white/70 text-sm">Set {i + 1}</div>

                        <input
                          type="number"
                          inputMode="numeric"
                          value={reps[i] ?? 0}
                          onChange={(e) => {
                            const n = Number(e.target.value || 0)
                            const next = reps.slice()
                            next[i] = n
                            setReps(next)
                          }}
                          placeholder="Reps"
                          className="rounded-xl bg-[#06121c] border border-white/10 px-3 py-2 text-white outline-none focus:border-blue-400/60"
                        />

                        <input
                          type="number"
                          inputMode="numeric"
                          value={weight[i] ?? 0}
                          onChange={(e) => {
                            const n = Number(e.target.value || 0)
                            const next = weight.slice()
                            next[i] = n
                            setWeight(next)
                          }}
                          placeholder="Weight"
                          className="rounded-xl bg-[#06121c] border border-white/10 px-3 py-2 text-white outline-none focus:border-blue-400/60"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={saveExercise}
                  disabled={saving}
                  className="w-full rounded-xl py-3 font-semibold bg-emerald-600 hover:bg-emerald-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? "Saving..." : "Add"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
