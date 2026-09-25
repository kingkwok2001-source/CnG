import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
}

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: cors })

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" })

  const authorization = req.headers.get("Authorization")
  if (!authorization?.startsWith("Bearer ")) return reply(401, { error: "請重新登入後再試" })

  const url = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const token = authorization.slice(7)
  const { data: { user }, error: userError } = await admin.auth.getUser(token)
  if (userError || !user) return reply(401, { error: "登入已過期，請重新登入" })

  try {
    const { data: owned, error: ownedError } = await admin
      .from("projects").select("id").eq("owner_id", user.id)
    if (ownedError) throw ownedError

    const ownedIds = (owned ?? []).map((project) => project.id)
    if (ownedIds.length) {
      const { data: files, error: fileError } = await admin
        .from("attachments").select("storage_path").in("project_id", ownedIds)
      if (fileError) throw fileError
      const paths = (files ?? []).map((file) => file.storage_path).filter(Boolean)
      for (let i = 0; i < paths.length; i += 100) {
        const { error } = await admin.storage.from("finance-attachments").remove(paths.slice(i, i + 100))
        if (error) throw error
      }
    }

    // Invites created for a shared project do not cascade from auth.users.
    const { error: inviteError } = await admin.from("project_invites").delete().eq("created_by", user.id)
    if (inviteError) throw inviteError

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
    if (deleteError) throw deleteError
    return reply(200, { success: true })
  } catch (error) {
    console.error("delete-account", error)
    return reply(500, { error: "暫時未能刪除帳號，請稍後再試" })
  }
})
