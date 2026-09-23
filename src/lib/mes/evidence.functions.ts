import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "mes-evidence";
const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = ["image/", "application/pdf", "video/"];

async function requireAction(context: { supabase: any; userId: string }, action: string) {
  const { data } = await context.supabase.rpc("has_action", {
    _user_id: context.userId,
    _action: action,
  });
  if (!data) throw new Error("You do not have permission for evidence files");
}

/**
 * Issues a short-lived upload ticket for one evidence file. The caller must
 * hold an execution or hold-raising permission; the path is server-chosen so a
 * client cannot overwrite another record's evidence.
 */
export const createEvidenceUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { prefix: string; fileName: string; contentType: string; size: number }) => {
    if (!d.fileName) throw new Error("A file is required");
    if (d.size > MAX_BYTES) throw new Error("Files must be 15 MB or smaller");
    if (!ALLOWED.some((a) => (d.contentType || "").startsWith(a))) {
      throw new Error("Only images, videos and PDF files are accepted as evidence");
    }
    return d;
  })
  .handler(async ({ data, context }) => {
    const { data: canRecord } = await context.supabase.rpc("has_action", {
      _user_id: context.userId,
      _action: "execution.record",
    });
    if (!canRecord) await requireAction(context, "holds.raise");

    const safePrefix = (data.prefix || "misc").replace(/[^A-Za-z0-9/_-]/g, "").slice(0, 80) || "misc";
    const ext = (data.fileName.split(".").pop() ?? "bin").replace(/[^A-Za-z0-9]/g, "").slice(0, 8);
    const path = `${safePrefix}/${context.userId}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, signedUrl: signed.signedUrl, token: signed.token };
  });

/** Short-lived view link for a stored evidence file. */
export const createEvidenceViewUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { path: string }) => {
    if (!d.path || d.path.includes("..")) throw new Error("Unknown evidence file");
    return d;
  })
  .handler(async ({ data, context }) => {
    await requireAction(context, "execution.read");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(data.path, 300);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });
