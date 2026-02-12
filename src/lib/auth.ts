import { supabase } from "@/lib/supabaseClient"

export async function getEmailForIdentifier(identifier: string) {
  const input = identifier.trim()

  if (input.includes("@")) return input.toLowerCase()

  const { data, error } = await supabase.rpc("email_for_username", { u: input })
  if (error) return null

  // data is the returned text (email) or null
  return data ? String(data).toLowerCase() : null
}
