"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

type Template = {
  id: string
  name: string
  created_at: string
}

type TemplateExercise = {
  id: string
  template_id: string
  exercise_name: string
  category: string
  sets: number
  reps: number[]
  weight: number[]
  created_at: string
}

const CATEGORY_OPTIONS = ["Lifting", "Cardio"] as const

export default function TemplatesPage() {
  const router = useRouter()

  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId]
  )

  const [exLoading, setExLoading] = useState(false)
  const [exercises, setExercises] = useState<TemplateExercise[]>([])

  // rename
  const [renameValue, setRenameValue] = useState("")
  const [renaming, setRenaming] = useState(false)

  // add/edit modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const editing = useMemo(
    () => exercises.find((e) => e.id === editingId) ?? null,
    [exercises, editingId]
  )

  const [saving, setSaving] = useState(false)
  const [category, setCategory] =
    useState<(typeof CATEGORY_OPTIONS)[number]>("Lifting")
  const [exerciseName, setExerciseName] = useState("")
  const [sets, setSets] = useState(3)
  const [reps, setReps] = useState<number[]>([12, 10, 8])
  const [weight, setWeight] = useState<number[]>([0, 0, 0])

  // prevents stale loadExercises responses from overwriting newer selection
  const exReqId = useRef(0)

  function syncArrays(newSets: number) {
    const nextReps = Array.from({ length: newSets }, (_, i) => reps[i] ?? 0)
    const nextWeight = Array.from({ length: newSets }, (_, i) => weight[i] ?? 0)
    setReps(nextReps)
    setWeight(nextWeight)
  }

  function openAdd() {
    setEditingId(null)
    setCategory("Lifting")
    setExerciseName("")
    setSets(3)
    setReps([12, 10, 8])
    setWeight([0, 0, 0])
    setModalOpen(true)
  }

  function openEdit(id: string) {
    const ex = exercises.find((e) => e.id === id)
    if (!ex) return
    setEditingId(id)
    setCategory((ex.category as any) ?? "Lifting")
    setExerciseName(ex.exercise_name ?? "")
    setSets(ex.sets ?? 1)
    setReps(Array.isArray(ex.reps) ? ex.reps : [])
    setWeight(Array.isArray(ex.weight) ? ex.weight : [])
    setModalOpen(true)
  }

  async function ensureUser() {
    const { data } = await supabase.auth.getUser()
    if (!data.user) {
      router.replace("/login")
      return null
    }
    return data.user
  }

  async function bootstrapUser() {
    const u = await ensureUser()
    if (!u) return
    setUserId(u.id)
  }

  async function loadTemplates() {
    if (!userId) return

    setLoading(true)
    const res = await supabase
      .from("templates")
      .select("id, name, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10)

    setLoading(false)

    if (res.error) {
      console.warn(res.error.message)
      setTemplates([])
      setSelectedId(null)
      setExercises([])
      return
    }

    const list = (res.data ?? []) as Template[]
    setTemplates(list)

    // keep current selection if it still exists; otherwise select first
    const currentStillExists = selectedId && list.some((t) => t.id === selectedId)
    const nextSelected = currentStillExists ? selectedId : (list[0]?.id ?? null)
    setSelectedId(nextSelected)
    if (!nextSelected) setExercises([])
  }

  async function loadExercises(templateId: string) {
    if (!userId) return

    const myReq = ++exReqId.current
    setExLoading(true)

    const res = await supabase
      .from("template_exercises")
      .select(
        "id, template_id, exercise_name, category, sets, reps, weight, created_at"
      )
      .eq("template_id", templateId)
      .order("created_at", { ascending: true })

    // ignore stale results
    if (myReq !== exReqId.current) return

    setExLoading(false)

    if (res.error) {
      console.warn(res.error.message)
      setExercises([])
      return
    }

    const rows = (res.data ?? []).map((r: any) => ({
      ...r,
      reps: Array.isArray(r.reps) ? r.reps : [],
      weight: Array.isArray(r.weight) ? r.weight : [],
    }))

    setExercises(rows as TemplateExercise[])
  }

  // 1) Get user once
  useEffect(() => {
    bootstrapUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 2) Load templates after userId exists
  useEffect(() => {
    if (!userId) return
    loadTemplates()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // 3) Load exercises whenever selectedId changes
  useEffect(() => {
    if (!selectedId) {
      setExercises([])
      return
    }
    loadExercises(selectedId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  // 4) Sync rename input
  useEffect(() => {
    if (selected) setRenameValue(selected.name ?? "")
  }, [selected])

  // 5) Auto-refresh when tab/window regains focus
  useEffect(() => {
    if (!userId) return

    const onFocus = () => loadTemplates()
    const onVis = () => {
      if (document.visibilityState === "visible") loadTemplates()
    }

    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVis)

    return () => {
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVis)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  async function saveRename() {
    if (!selected) return
    const name = renameValue.trim()
    if (!name) return alert("Name cannot be empty.")

    setRenaming(true)
    const res = await supabase.from("templates").update({ name }).eq("id", selected.id)
    setRenaming(false)

    if (res.error) return alert(res.error.message)

    setTemplates((prev) =>
      prev.map((t) => (t.id === selected.id ? { ...t, name } : t))
    )
  }

  async function deleteTemplate(id: string) {
    if (!confirm("Delete this template? This cannot be undone.")) return
    const res = await supabase.from("templates").delete().eq("id", id)
    if (res.error) return alert(res.error.message)

    setTemplates((prev) => {
      const next = prev.filter((t) => t.id !== id)

      if (selectedId === id) {
        const nextId = next[0]?.id ?? null
        setSelectedId(nextId)
        if (!nextId) setExercises([])
      }

      return next
    })
  }

  async function deleteExercise(id: string) {
    if (!confirm("Delete this exercise from the template?")) return
    const res = await supabase.from("template_exercises").delete().eq("id", id)
    if (res.error) return alert(res.error.message)
    setExercises((prev) => prev.filter((e) => e.id !== id))
  }

  async function saveExercise() {
    if (!selectedId) return alert("Select a template first.")
    if (!userId) return alert("Not logged in.")

    const name = exerciseName.trim()
    if (!name) return alert("Enter an exercise name.")
    if (sets < 1 || sets > 24) return alert("Sets must be 1–24.")
    if (reps.length !== sets || weight.length !== sets)
      return alert("Fix sets inputs.")

    setSaving(true)

    if (!editingId) {
      const ins = await supabase.from("template_exercises").insert({
        template_id: selectedId,
        user_id: userId, // IMPORTANT if your template_exercises has user_id + RLS
        exercise_name: name,
        category,
        sets,
        reps,
        weight,
      })

      setSaving(false)
      if (ins.error) return alert(ins.error.message)

      setModalOpen(false)
      await loadExercises(selectedId)
      return
    }

    const upd = await supabase
      .from("template_exercises")
      .update({
        exercise_name: name,
        category,
        sets,
        reps,
        weight,
      })
      .eq("id", editingId)

    setSaving(false)
    if (upd.error) return alert(upd.error.message)

    setModalOpen(false)
    await loadExercises(selectedId)
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-xl px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 transition font-medium"
            >
              ← Back
            </button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
              <p className="text-white/60 text-sm">Rename, edit, delete (max 10).</p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: list */}
          <div className="lg:col-span-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Your templates</div>
              <button
                onClick={loadTemplates}
                className="text-sm text-white/70 hover:text-white transition"
              >
                Refresh
              </button>
            </div>

            <div className="mt-3">
              {loading ? (
                <div className="text-white/70">Loading...</div>
              ) : templates.length === 0 ? (
                <div className="text-white/60">
                  No templates yet. Save one from a workout first.
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedId(t.id)}
                      className={[
                        "w-full rounded-xl border p-3 transition cursor-pointer select-none",
                        t.id === selectedId
                          ? "bg-[#06121c] border-blue-400/30"
                          : "bg-[#06121c] border-white/10 hover:bg-[#071a28]",
                      ].join(" ")}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") setSelectedId(t.id)
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold truncate">{t.name}</div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteTemplate(t.id)
                          }}
                          className="text-xs text-white/60 hover:text-red-300 transition"
                          type="button"
                        >
                          Delete
                        </button>
                      </div>

                      <div className="text-xs text-white/50 mt-1">
                        {new Date(t.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: detail */}
          <div className="lg:col-span-8 rounded-2xl border border-white/10 bg-white/5 p-5">
            {!selected ? (
              <div className="text-white/70">Select a template to edit.</div>
            ) : (
              <>
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                  <div className="w-full">
                    <label className="text-sm text-white/70">Template name</label>
                    <input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      className="mt-2 w-full rounded-xl bg-[#06121c] border border-white/10 px-4 py-3 text-white outline-none focus:border-blue-400/60"
                    />
                  </div>

                  <button
                    onClick={saveRename}
                    disabled={renaming}
                    className="rounded-xl px-4 py-3 bg-blue-600 hover:bg-blue-700 transition font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {renaming ? "Saving..." : "Save Name"}
                  </button>
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Exercises</h2>
                    <p className="text-xs text-white/60">
                      Stored in the template (used from the workout “Choose Template” flow).
                    </p>
                  </div>

                  <button
                    onClick={openAdd}
                    className="rounded-xl px-4 py-2 bg-emerald-600 hover:bg-emerald-700 transition font-semibold"
                  >
                    Add Exercise
                  </button>
                </div>

                <div className="mt-4">
                  {exLoading ? (
                    <div className="text-white/70">Loading exercises...</div>
                  ) : exercises.length === 0 ? (
                    <div className="text-white/60">No exercises in this template yet.</div>
                  ) : (
                    <div className="space-y-3">
                      {exercises.map((ex) => (
                        <div
                          key={ex.id}
                          className="rounded-xl bg-[#06121c] border border-white/10 p-4"
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-semibold">{ex.exercise_name}</div>
                            <div className="text-xs text-white/60">{ex.category}</div>
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

                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => openEdit(ex.id)}
                              className="rounded-xl px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 transition text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteExercise(ex.id)}
                              className="rounded-xl px-3 py-2 bg-white/5 border border-white/10 hover:bg-red-500/20 transition text-sm text-white/80"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Add/Edit Exercise Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => !saving && setModalOpen(false)}
            />

            <div className="relative w-full max-w-xl rounded-2xl border border-white/10 bg-[#081a28] shadow-2xl p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">
                  {editing ? "Edit Exercise" : "Add Exercise"}
                </h2>
                <button
                  onClick={() => !saving && setModalOpen(false)}
                  className="rounded-xl px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 transition font-medium"
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
                  {saving ? "Saving..." : editing ? "Save Changes" : "Add"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
