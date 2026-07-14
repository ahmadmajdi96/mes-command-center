import { useEffect, useState } from "react";
import { Upload, X, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { uploadEvidenceFile, signedEvidenceUrl } from "@/lib/hmi-db";

export function EvidenceUploader({
  value,
  onChange,
  prefix,
  label = "Evidence",
}: {
  value: string[];
  onChange: (paths: string[]) => void;
  prefix?: string;
  label?: string;
}) {
  const [uploading, setUploading] = useState(false);

  async function handle(files: FileList | null) {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      const paths: string[] = [];
      for (const f of Array.from(files)) {
        const p = await uploadEvidenceFile(f, prefix ?? "misc");
        paths.push(p);
      }
      onChange([...value, ...paths]);
      toast.success(`Uploaded ${paths.length} file(s)`);
    } catch (e) {
      toast.error(`Upload failed: ${(e as Error).message}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-xs hover:bg-card">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Upload files
          <input
            type="file"
            multiple
            accept="image/*,application/pdf,video/*"
            className="hidden"
            onChange={(e) => handle(e.target.files)}
            disabled={uploading}
          />
        </label>
        {value.map((p, i) => (
          <EvidenceChip
            key={p}
            path={p}
            onRemove={() => onChange(value.filter((_, j) => j !== i))}
          />
        ))}
      </div>
    </div>
  );
}

export function EvidenceChip({ path, onRemove }: { path: string; onRemove?: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    signedEvidenceUrl(path).then((u) => {
      if (alive) setUrl(u);
    }).catch(() => {});
    return () => { alive = false; };
  }, [path]);
  const name = path.split("/").pop() ?? path;
  return (
    <span className="inline-flex items-center gap-1 rounded border border-border/60 bg-background/60 px-2 py-1 text-[11px]">
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-primary">
          <FileText className="h-3 w-3" />
          <span className="max-w-[140px] truncate font-mono">{name}</span>
        </a>
      ) : (
        <span className="inline-flex items-center gap-1 opacity-60">
          <FileText className="h-3 w-3" /> {name}
        </span>
      )}
      {onRemove && (
        <button onClick={onRemove} className="text-destructive hover:text-destructive/80" title="Remove">
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
