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

type TemplateRow = {
  id: string
  name: string
  created_at: string
}

type TemplateExerciseRow = {
  exercise_name: string
  category: string
  sets: number
  reps: number[]
  weight: number[]
}

export default function DayPage() {
  const router = useRouter()
  const params = useParams<{ date: string }>()
  const iso = params?.date

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

  const [loading, setLoading] = useState(true)
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([])

  // Create flow modal: New vs Template
  const [createFlowOpen, setCreateFlowOpen] = useState(false)

  // Create New form (screenshot 2)
  const [createNewOpen, setCreateNewOpen] = useState(false)
  const [splitTitle, setSplitTitle] = useState("")
  const [creating, setCreating] = useState(false)

  // Template picker (only for creating a workout)
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [applyingTemplate, setApplyingTemplate] = useState(false)

  // Per-workout menu (⋯)
  const [menuForWorkout, setMenuForWorkout] = useState<string | null>(null)
  const [deletingWorkout, setDeletingWorkout] = useState<string | null>(null)

  async function requireUser() {
    const { data } = await supabase.auth.getUser()
    if (!data.user) {
      router.replace("/login")
      return null
    }
    return data.user
  }

  async function loadWorkouts() {
    if (!iso) return
    const user = await requireUser()
    if (!user) return

    setLoading(true)

    const res = await supabase
      .from("workouts")
      .select("id, user_id, date, split_title, created_at")
      .eq("user_id", user.id)
      .eq("date", iso)
      .order("created_at", { ascending: true })

    setLoading(false)

    if (res.error) {
      console.warn(res.error.message)
      setWorkouts([])
      return
    }

    setWorkouts((res.data ?? []) as WorkoutRow[])
  }

  useEffect(() => {
    loadWorkouts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso])

  async function createWorkoutNew() {
    if (!iso) return
    const user = await requireUser()
    if (!user) return

    const title = splitTitle.trim()
    if (!title) return alert("Enter a split title.")

    setCreating(true)

    const ins = await supabase
      .from("workouts")
      .insert({
        user_id: user.id,
        date: iso,
        split_title: title,
      })
      .select("id")
      .single()

    setCreating(false)

    if (ins.error) return alert(ins.error.message)

    // Go straight to workout details (this is what you want)
    const workoutId = ins.data.id as string
    router.push(`/dashboard/${iso}/workout/${workoutId}`)
  }

  async function loadTemplatesList() {
    const user = await requireUser()
    if (!user) return

    setTemplatesLoading(true)
    const res = await supabase
      .from("templates")
      .select("id, name, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10)

    setTemplatesLoading(false)

    if (res.error) return alert(res.error.message)
    setTemplates((res.data ?? []) as TemplateRow[])
  }

  async function createWorkoutFromTemplate(templateId: string) {
    if (!iso) return
    const user = await requireUser()
    if (!user) return

    setApplyingTemplate(true)

    // 1) read template name
    const tRes = await supabase
      .from("templates")
      .select("id, name")
      .eq("id", templateId)
      .eq("user_id", user.id)
      .single()

    if (tRes.error || !tRes.data) {
      setApplyingTemplate(false)
      return alert(tRes.error?.message ?? "Template not found")
    }

    // 2) read template exercises
    const teRes = await supabase
      .from("template_exercises")
      .select("exercise_name, category, sets, reps, weight")
      .eq("template_id", templateId)
      .order("created_at", { ascending: true })

    if (teRes.error) {
      setApplyingTemplate(false)
      return alert(teRes.error.message)
    }

    const teList = (teRes.data ?? []) as any as TemplateExerciseRow[]

    // 3) create workout
    const wIns = await supabase
      .from("workouts")
      .insert({
        user_id: user.id,
        date: iso,
        split_title: tRes.data.name,
      })
      .select("id")
      .single()

    if (wIns.error || !wIns.data) {
      setApplyingTemplate(false)
      return alert(wIns.error?.message ?? "Failed to create workout")
    }

    const workoutId = wIns.data.id as string

    // 4) copy template exercises into exercises (NO user_id in exercises needed)
    if (teList.length > 0) {
      const rows = teList.map((te) => ({
        workout_id: workoutId,
        exercise_name: te.exercise_name,
        category: te.category,
        sets: te.sets,
        reps: Array.isArray(te.reps) ? te.reps : [],
        weight: Array.isArray(te.weight) ? te.weight : [],
      }))

      const exIns = await supabase.from("exercises").insert(rows)
      if (exIns.error) {
        setApplyingTemplate(false)
        return alert(exIns.error.message)
      }
    }

    // 5) close modals and refresh day list, stay on day page
    setApplyingTemplate(false)
    setTemplatePickerOpen(false)
    setCreateFlowOpen(false)
    setSplitTitle("")
    await loadWorkouts()
  }

  async function deleteWorkout(workoutId: string) {
    if (!confirm("Delete this workout and all its exercises?")) return

    setDeletingWorkout(workoutId)

    // delete exercises first (safe even if none)
    const delEx = await supabase.from("exercises").delete().eq("workout_id", workoutId)
    if (delEx.error) {
      setDeletingWorkout(null)
      return alert(delEx.error.message)
    }

    // delete workout
    const delW = await supabase.from("workouts").delete().eq("id", workoutId)
    setDeletingWorkout(null)

    if (delW.error) return alert(delW.error.message)

    setMenuForWorkout(null)
    await loadWorkouts()
  }

  return (
    <div className="min-h-screen">
      {/* Create Workout flow modal (Create New / Use Template) */}
      {createFlowOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setCreateFlowOpen(false)}
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#081a28] shadow-2xl p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Create workout</h2>
              <button
                onClick={() => setCreateFlowOpen(false)}
                className="rounded-xl px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 transition"
              >
                ← Back
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <button
                onClick={() => {
                  setCreateFlowOpen(false)
                  setCreateNewOpen(true)
                }}
                className="w-full rounded-xl py-3 font-semibold bg-emerald-600 hover:bg-emerald-700 transition"
              >
                Create New
              </button>

              <button
                onClick={() => {
                  setCreateFlowOpen(false)
                  setTemplatePickerOpen(true)
                  loadTemplatesList()
                }}
                className="w-full rounded-xl py-3 font-semibold bg-white/5 border border-white/10 hover:bg-white/10 transition"
              >
                Use Template
              </button>

              <p className="text-xs text-white/50">
                Template will set the split name and copy its exercises into this day.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Create New form (your screenshot 2) */}
      {createNewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => !creating && setCreateNewOpen(false)}
          />
          <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-[#081a28] shadow-2xl p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">New workout</h2>
              <button
                onClick={() => !creating && setCreateNewOpen(false)}
                className="rounded-xl px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 transition"
              >
                ← Back
              </button>
            </div>

            <div className="mt-4">
              <input
                value={splitTitle}
                onChange={(e) => setSplitTitle(e.target.value)}
                placeholder="Split title (e.g. Push Day)"
                className="w-full rounded-xl bg-[#06121c] border border-white/10 px-4 py-3 text-white outline-none focus:border-blue-400/60"
              />

              <div className="mt-4 flex gap-2">
                <button
                  onClick={createWorkoutNew}
                  disabled={creating}
                  className="rounded-xl px-5 py-2 bg-emerald-600 hover:bg-emerald-700 transition font-semibold disabled:opacity-60"
                >
                  {creating ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => !creating && setCreateNewOpen(false)}
                  className="rounded-xl px-5 py-2 bg-white/5 border border-white/10 hover:bg-white/10 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template picker (for creating workout from template) */}
      {templatePickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => !applyingTemplate && setTemplatePickerOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#081a28] shadow-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-bold">Choose a template</div>
                <div className="text-xs text-white/60 mt-1">
                  Creates a workout and copies exercises into this day.
                </div>
              </div>

              <button
                onClick={() => setTemplatePickerOpen(false)}
                disabled={applyingTemplate}
                className="rounded-xl px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 transition"
              >
                ← Back
              </button>
            </div>

            <div className="mt-4">
              {templatesLoading ? (
                <div className="text-white/70">Loading...</div>
              ) : templates.length === 0 ? (
                <div className="text-white/60">
                  No templates yet. Save one from a workout first.
                </div>
              ) : (
                <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      disabled={applyingTemplate}
                      onClick={() => createWorkoutFromTemplate(t.id)}
                      className="w-full text-left rounded-xl bg-[#06121c] border border-white/10 p-4 hover:bg-[#071a28] transition disabled:opacity-60"
                    >
                      <div className="font-semibold truncate">{t.name}</div>
                      <div className="text-xs text-white/50 mt-1">
                        {new Date(t.created_at).toLocaleString()}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {applyingTemplate && (
              <div className="mt-4 text-sm text-white/70">Creating workout...</div>
            )}
          </div>
        </div>
      )}

      {/* Main */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-xl px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 transition"
            >
              ← Back
            </button>

            <div>
              <div className="text-white/60 text-sm">{pretty}</div>
              <div className="text-white/50 text-xs mt-1">{iso}</div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Workouts</h2>
            <button
              onClick={() => setCreateFlowOpen(true)}
              className="rounded-xl px-4 py-2 bg-blue-600 hover:bg-blue-700 transition font-semibold"
            >
              Create Workout
            </button>
          </div>

          <div className="mt-4">
            {loading ? (
              <div className="text-white/70">Loading...</div>
            ) : workouts.length === 0 ? (
              <div className="text-white/60">No workout logged for this day yet.</div>
            ) : (
              <div className="space-y-2">
                {workouts.map((w) => (
                  <div
                    key={w.id}
                    className="rounded-xl bg-[#06121c] border border-white/10 p-4 flex items-center justify-between gap-3"
                  >
                    <div
                      className="cursor-pointer"
                      onClick={() => router.push(`/dashboard/${iso}/workout/${w.id}`)}
                    >
                      <div className="font-semibold">{w.split_title ?? "Workout"}</div>
                      <div className="text-xs text-white/60 mt-1">
                        Click to view / add exercises
                      </div>
                    </div>

                    <div className="relative">
                      <button
                        onClick={() => setMenuForWorkout((cur) => (cur === w.id ? null : w.id))}
                        className="rounded-xl px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 transition"
                        aria-label="Workout menu"
                      >
                        ⋯
                      </button>

                      {menuForWorkout === w.id && (
                        <>
                          <button
                            className="fixed inset-0 cursor-default"
                            onClick={() => setMenuForWorkout(null)}
                            aria-label="Close menu"
                          />
                          <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-white/10 bg-[#081a28] shadow-2xl p-2 z-50">
                            <button
                              onClick={() => deleteWorkout(w.id)}
                              disabled={deletingWorkout === w.id}
                              className="w-full text-left rounded-xl px-3 py-2 hover:bg-red-500/20 transition text-white/90 disabled:opacity-50"
                            >
                              {deletingWorkout === w.id ? "Deleting..." : "Delete workout"}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
