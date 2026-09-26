import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4"

const cors = {
  "Access-Control-Allow-Origin": "https://cng-finance.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
}
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: cors })

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" })
  const url = Deno.env.get("SUPABASE_URL")!
  const options = { auth: { autoRefreshToken: false, persistSession: false } }
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, options)

  async function cleanup() {
    // Tombstones also catch uploads completing concurrently with deletion.
    // Remove actual files with Storage API, never by deleting metadata directly.
    for (let i = 0; i < 5; i++) {
      const { data, error } = await admin.rpc("finance_cleanup_batch")
      if (error) throw error
      if (!data?.length) return false
      const { error: removeError } = await admin.storage.from("finance-attachments")
        .remove(data.map((file: { path: string }) => file.path))
      if (removeError) throw removeError
    }
    return true
  }

  try {
    const cleanupToken = req.headers.get("x-cleanup-token")
    if (cleanupToken) {
      const { data: authorized, error } = await admin.rpc("finance_cleanup_authorized", { p_token: cleanupToken })
      if (error || authorized !== true) return reply(401, { error: "Unauthorized" })
      return reply(200, { success: true, cleanup_pending: await cleanup() })
    }
    const authorization = req.headers.get("Authorization")
    if (!authorization?.startsWith("Bearer ")) return reply(401, { error: "請重新登入後再試" })
    const { data: { user }, error: userError } = await admin.auth.getUser(authorization.slice(7))
    if (userError || !user || !user.email) return reply(401, { error: "登入已過期，請重新登入" })
    const body = await req.json().catch(() => null)
    if (body?.confirm !== "刪除" || typeof body.password !== "string" || !body.password) {
      return reply(400, { error: "請輸入「刪除」及目前密碼確認。" })
    }

    // Fresh proof of identity; callers cannot choose an account ID.
    const verifier = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, options)
    const { data: verified, error: verifyError } = await verifier.auth.signInWithPassword({
      email: user.email, password: body.password,
    })
    if (verifyError || verified.user?.id !== user.id) {
      return reply(403, { error: "密碼驗證失敗，帳號及資料未有刪除。" })
    }
    const { error: deleteError } = await admin.rpc("finish_finance_account_deletion", { p_user: user.id })
    if (deleteError) {
      await verifier.auth.signOut({ scope: "local" })
      throw deleteError
    }
    // auth.users cascades sessions and refresh tokens. RLS denies the removed
    // identity even while an old access JWT remains cryptographically valid.
    let pending = true
    try { pending = await cleanup() } catch { console.error("account file cleanup queued for retry") }
    return reply(200, { success: true, cleanup_pending: pending })
  } catch {
    console.error("delete-account request failed")
    return reply(500, { error: "未能完成刪除，請稍後重試。" })
  }
})
