import { useEffect, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export type FieldType = "text" | "number" | "textarea" | "select" | "multiselect" | "file" | "datetime";

/** Radix Select forbids "" as an item value; empty options map to this sentinel. */
const NONE = "__none__";

function toLocalInput(v: unknown) {
  if (!v) return "";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export interface Field {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  /** Optional guidance shown directly beneath the field. */
  description?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  span?: 1 | 2;
  /** For multiselect: minimum number of selections required */
  minSelected?: number;
  /** For file: accept attribute, e.g. "image/*,application/pdf" */
  accept?: string;
  /** For file: max size in bytes (default 3MB — larger crashes localStorage) */
  maxBytes?: number;
  /** Show this field only when another field equals one of these values */
  visibleWhen?: { field: string; equals: string | string[] };
  /** Logical section header rendered before the field */
  section?: string;
  /** For number: lowest allowed value (e.g. 0 for non-negative). */
  min?: number;
  /** For number: highest allowed value. */
  max?: number;
  /** For number: step (use 1 for whole numbers). */
  step?: number;
  /** For number: whole numbers only. */
  integer?: boolean;
  /** For datetime: must be on/after this other datetime field. */
  notBefore?: string;
}

/** Validate one field; returns an error message or null. Used live and on submit. */
function fieldError(f: Field, v: any, all: Record<string, any>): string | null {
  if (f.type === "multiselect") {
    const min = f.minSelected ?? (f.required ? 1 : 0);
    return min > 0 && (!Array.isArray(v) || v.length < min) ? `Select at least ${min} option${min === 1 ? "" : "s"}` : null;
  }
  if (f.type === "file") return f.required && !v ? "File is required" : null;
  if (f.required && (v === "" || v == null)) return `${f.label} is required`;
  if (f.type === "number" && v !== "" && v != null) {
    const n = Number(v);
    if (!Number.isFinite(n)) return `${f.label} must be a number`;
    if (f.min !== undefined && n < f.min) return f.min === 0 ? `${f.label} cannot be negative` : `${f.label} must be at least ${f.min}`;
    if (f.max !== undefined && n > f.max) return `${f.label} must be at most ${f.max}`;
    if (f.integer && !Number.isInteger(n)) return `${f.label} must be a whole number`;
  }
  if (f.type === "datetime" && v) {
    if (Number.isNaN(new Date(v).getTime())) return `${f.label} is not a valid date`;
    const other = f.notBefore ? all[f.notBefore] : null;
    if (other && new Date(v).getTime() < new Date(other).getTime()) return `${f.label} must be after the start`;
  }
  return null;
}

export function EntityFormDialog<T extends Record<string, any>>({
  title,
  description,
  trigger,
  fields,
  initial,
  onSubmit,
  submitLabel = "Save",
}: {
  title: string;
  description?: string;
  trigger: ReactNode;
  fields: Field[];
  initial?: Partial<T>;
  onSubmit: (values: T) => void;
  submitLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);


  useEffect(() => {
    if (open) {
      const seed: Record<string, any> = {};
      fields.forEach((f) => {
        const init = (initial as any)?.[f.name];
        if (f.type === "multiselect") seed[f.name] = Array.isArray(init) ? init : [];
        else if (f.type === "file") seed[f.name] = init ?? null;
        else if (f.type === "datetime") seed[f.name] = toLocalInput(init);
        else seed[f.name] = init ?? (f.type === "number" ? 0 : "");
      });
      setValues(seed);
      setErrors({});
    }
  }, [open]);

  const setField = (f: Field, val: any) =>
    setValues((cur) => {
      const next = { ...cur, [f.name]: val };
      setErrors((e) => {
        const copy = { ...e };
        const msg = fieldError(f, val, next);
        if (msg && (e[f.name] || f.type === "number" || f.type === "datetime")) copy[f.name] = msg; else delete copy[f.name];
        return copy;
      });
      return next;
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaveError(null);
    const errs: Record<string, string> = {};
    for (const f of fields) {
      // Skip validation for fields hidden by visibleWhen
      if (f.visibleWhen) {
        const v = values[f.visibleWhen.field];
        const want = f.visibleWhen.equals;
        const ok = Array.isArray(want) ? want.includes(v) : v === want;
        if (!ok) continue;
      }
      const msg = fieldError(f, values[f.name], values);
      if (msg) errs[f.name] = msg;
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error(`Fix ${Object.keys(errs).length} field${Object.keys(errs).length === 1 ? "" : "s"} before saving`);
      return;
    }
    // Only report success once the save has actually completed. On failure the
    // dialog stays open with the entered values so nothing is silently lost.
    setSaving(true);
    try {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(values)) out[k] = v === NONE ? "" : v;
      await onSubmit(out as T);
      toast.success(`${title.replace(/^(Create|New|Edit) /, "")} saved`);
      setOpen(false);
    } catch (err: any) {
      const message = err?.message ?? "Could not save. Please try again.";
      setSaveError(message);
      toast.error(`Not saved — ${message}`);
    } finally {
      setSaving(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="glass-panel max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={submit} className="grid max-h-[70vh] grid-cols-2 gap-4 overflow-y-auto pr-1">
          {fields.map((f, idx) => {
            if (f.visibleWhen) {
              const v = values[f.visibleWhen.field];
              const want = f.visibleWhen.equals;
              const ok = Array.isArray(want) ? want.includes(v) : v === want;
              if (!ok) return null;
            }
            const prev = fields[idx - 1];
            const showSection = f.section && f.section !== prev?.section;
            return (
              <div key={f.name} className={f.span === 2 ? "col-span-2" : "col-span-2 sm:col-span-1"}>
                {showSection && (
                  <div className="col-span-2 mb-1 mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/80">
                    {f.section}
                  </div>
                )}
                <Label htmlFor={f.name} className="text-xs uppercase tracking-wider text-muted-foreground">
                  {f.label}
                </Label>
                <div className="mt-1.5">
                  {f.type === "textarea" ? (
                    <Textarea
                      id={f.name}
                      value={values[f.name] ?? ""}
                      placeholder={f.placeholder}
                      onChange={(e) => setField(f, e.target.value)}
                      className={`bg-card/60 ${errors[f.name] ? "border-destructive/60" : ""}`}
                    />
                  ) : f.type === "select" ? (
                    <Select
                      value={values[f.name] === "" || values[f.name] == null ? undefined : String(values[f.name])}
                      onValueChange={(val) => setField(f, val === NONE ? "" : val)}
                    >
                      <SelectTrigger id={f.name} className={`bg-card/60 ${errors[f.name] ? "border-destructive/60" : ""}`}>
                        <SelectValue placeholder={f.placeholder ?? "Select…"} />
                      </SelectTrigger>
                      <SelectContent>
                        {f.options?.map((o) => (
                          <SelectItem key={o.value || NONE} value={o.value || NONE}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : f.type === "multiselect" ? (
                    <div
                      className={`flex flex-wrap gap-1.5 rounded-lg border bg-card/60 p-2 ${
                        errors[f.name] ? "border-destructive/60" : "border-border/60"
                      }`}
                    >
                      {f.options?.map((o) => {
                        const cur: string[] = Array.isArray(values[f.name]) ? values[f.name] : [];
                        const on = cur.includes(o.value);
                        return (
                          <button
                            type="button"
                            key={o.value}
                            onClick={() =>
                              setValues((v) => {
                                const arr: string[] = Array.isArray(v[f.name]) ? v[f.name] : [];
                                return { ...v, [f.name]: on ? arr.filter((x) => x !== o.value) : [...arr, o.value] };
                              })
                            }
                            className={`rounded-md border px-2 py-1 text-[11px] transition ${
                              on
                                ? "border-primary/60 bg-primary/15 text-primary"
                                : "border-border/60 bg-background/40 text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {o.label}
                          </button>
                        );
                      })}
                      {(!f.options || f.options.length === 0) && (
                        <span className="text-[11px] text-muted-foreground">No options available</span>
                      )}
                    </div>
                  ) : f.type === "file" ? (
                    <div className={`rounded-lg border bg-card/60 p-2 text-xs ${
                      errors[f.name] ? "border-destructive/60" : "border-border/60"
                    }`}>
                      <input
                        id={f.name}
                        type="file"
                        accept={f.accept}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const max = f.maxBytes ?? 3 * 1024 * 1024;
                          if (file.size > max) {
                            toast.error(`File too large — max ${Math.round(max / 1024 / 1024)}MB`);
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () =>
                            setValues((v) => ({
                              ...v,
                              [f.name]: {
                                name: file.name,
                                size: file.size,
                                mime: file.type,
                                dataUrl: reader.result as string,
                              },
                            }));
                          reader.readAsDataURL(file);
                        }}
                        className="block w-full text-xs file:mr-3 file:rounded file:border file:border-primary/40 file:bg-primary/10 file:px-2 file:py-1 file:text-xs file:font-medium file:text-primary hover:file:bg-primary/20"
                      />
                      {values[f.name] && typeof values[f.name] === "object" && (
                        <div className="mt-1.5 flex items-center justify-between rounded border border-border/60 bg-background/40 px-2 py-1">
                          <span className="truncate font-mono text-[11px]">{values[f.name].name}</span>
                          <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                            {Math.round((values[f.name].size ?? 0) / 1024)} KB
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Input
                      id={f.name}
                      type={f.type === "number" ? "number" : f.type === "datetime" ? "datetime-local" : "text"}
                      inputMode={f.type === "number" ? (f.integer ? "numeric" : "decimal") : undefined}
                      min={f.type === "number" ? f.min : f.type === "datetime" && f.notBefore ? values[f.notBefore] || undefined : undefined}
                      max={f.type === "number" ? f.max : undefined}
                      step={f.type === "number" ? (f.step ?? (f.integer ? 1 : "any")) : undefined}
                      aria-invalid={!!errors[f.name]}
                      value={values[f.name] ?? ""}
                      placeholder={f.placeholder}
                      onKeyDown={(e) => {
                        if (f.type === "number" && f.min !== undefined && f.min >= 0 && e.key === "-") e.preventDefault();
                      }}
                      onChange={(e) =>
                        setField(f, f.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)
                      }
                      className={`bg-card/60 ${errors[f.name] ? "border-destructive/60" : ""}`}
                    />
                  )}
                </div>
                {errors[f.name] && (
                  <div className="mt-1 text-[11px] text-destructive">{errors[f.name]}</div>
                )}
                {!errors[f.name] && f.description && (
                  <div className="mt-1 text-[11px] leading-snug text-muted-foreground">{f.description}</div>
                )}
              </div>
            );
          })}
          {saveError && (
            <div className="col-span-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {saveError}
            </div>
          )}
          <DialogFooter className="col-span-2 mt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={saving}
              className="rounded-lg border border-border/60 bg-card/60 px-4 py-2 text-sm disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-gradient-to-br from-primary to-info px-4 py-2 text-sm font-medium text-primary-foreground shadow-[var(--shadow-glow)] disabled:opacity-60"
            >
              {saving ? "Saving…" : submitLabel}
            </button>
          </DialogFooter>

        </form>
      </DialogContent>
    </Dialog>
  );
}
