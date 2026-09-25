import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM = `You are a senior manufacturing process and maintenance engineer supporting line operators in a food & beverage plant running an MES.
Given an operator's description of a production issue plus station context, respond in concise Markdown with these sections:
**Likely causes** (ranked, max 5), **Checks to do now** (numbered, safe steps an operator can do), **Next steps** (who to call, whether to put the station on hold for quality or maintenance, whether affected items should be held, scrapped or reworked), **Safety** (lockout/tagout, food-safety/CCP notes when relevant).
Never tell operators to bypass guards, interlocks or critical control points. If the issue could affect food safety, say to hold the product. Keep it under 300 words.`;

export const troubleshootIssue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { description: string; station_id?: string; station_name?: string; line_name?: string; unit_uid?: string | null }) => {
    const description = (d.description ?? "").trim();
    if (description.length < 5) throw new Error("Describe the issue in a few words");
    if (description.length > 4000) throw new Error("Description is too long (max 4000 characters)");
    return { ...d, description };
  })
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI assistant is not configured");
    const supabase = (context as { supabase: any }).supabase;

    // Recent station context (RLS-scoped to the operator's company).
    let recent = "";
    if (data.station_id) {
      const [{ data: holds }, { data: waste }, { data: station }] = await Promise.all([
        supabase.from("station_holds").select("hold_type, reason, status, opened_at").eq("station_id", data.station_id).order("opened_at", { ascending: false }).limit(5),
        supabase.from("waste_events").select("reason_label, notes, created_at").eq("station_id", data.station_id).order("created_at", { ascending: false }).limit(5),
        supabase.from("stations").select("type, status, current_step, machine").eq("id", data.station_id).maybeSingle(),
      ]);
      recent = JSON.stringify({ station, recent_holds: holds ?? [], recent_waste: waste ?? [] });
    }

    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      system: SYSTEM,
      prompt: `Line: ${data.line_name ?? "unknown"}\nStation: ${data.station_name ?? data.station_id ?? "unknown"}\nItem: ${data.unit_uid ?? "none"}\nStation context: ${recent || "n/a"}\n\nOperator's description:\n${data.description}`,
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });
    try {
      const text = await result.text;
      if (!text.trim()) return { guidance: "", error: "The assistant could not answer this request." };
      return { guidance: text, error: null as string | null };
    } catch (e: any) {
      const status = e?.statusCode ?? e?.status;
      console.error("troubleshoot failed", status, e?.message);
      if (status === 429) return { guidance: "", error: "The assistant is busy. Please try again in a minute." };
      if (status === 402) return { guidance: "", error: "AI credits are used up. Ask an admin to add credits in workspace settings." };
      if (status === 403) return { guidance: "", error: "The AI assistant is not available for this workspace right now." };
      return { guidance: "", error: "The assistant is unavailable right now." };
    }
  });
