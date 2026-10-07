import { useRef, useState } from "react";
import { toast } from "sonner";
import { Paperclip, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRows, useWrite, errMsg } from "@/lib/execution-db";
import { useMyOrg } from "@/lib/wip-db";
import { ghost } from "@/components/qp-ui";

/** Photo / file attachments for a record (nonconformance, order, step…). Files live in the private attachments store. */
export function Attachments({ kind, id }: { kind: string; id: string }) {
  const { data: org } = useMyOrg();
  const { data: all = [] } = useRows<any>("attachments", { order: "created_at", asc: false });
  const w = useWrite("attachments");
  const rows = all.filter((a: any) => a.entity_kind === kind && a.entity_id === id);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    if (!org) return;
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const name = u.user?.user_metadata?.full_name || u.user?.email || "User";
      const path = `${org}/${kind}/${id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("attachments").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      await w.insert.mutateAsync({ organization_id: org, entity_kind: kind, entity_id: id, file_path: path, file_name: file.name, content_type: file.type, uploaded_by: u.user?.id ?? null, uploaded_by_name: name });
      toast.success("Attached");
    } catch (e) { toast.error(errMsg(e)); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const openFile = async (a: any) => {
    const { data, error } = await supabase.storage.from("attachments").createSignedUrl(a.file_path, 300);
    if (error || !data?.signedUrl) return toast.error("Could not open the file");
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const remove = async (a: any) => {
    try {
      await supabase.storage.from("attachments").remove([a.file_path]);
      await w.remove.mutateAsync(a.id);
      toast.success("Removed");
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold"><Paperclip className="h-3.5 w-3.5 text-primary" />Photos &amp; files ({rows.length})</h3>
        <label className={ghost + " cursor-pointer"}>
          {busy ? "Uploading…" : "Attach"}
          <input ref={fileRef} type="file" accept="image/*,.pdf,.csv,.txt" className="hidden" disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
        </label>
      </div>
      {rows.length === 0 && <p className="text-[11px] text-muted-foreground">No photos or files yet.</p>}
      <div className="space-y-1">
        {rows.map((a: any) => (
          <div key={a.id} className="flex items-center gap-2 text-xs">
            <button className="truncate text-primary hover:underline" onClick={() => openFile(a)}>{a.file_name}</button>
            <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{a.uploaded_by_name} · {new Date(a.created_at).toLocaleDateString()}</span>
            <button className={ghost} onClick={() => remove(a)}><Trash2 className="h-3 w-3" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
