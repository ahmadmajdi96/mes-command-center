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

export type FieldType = "text" | "number" | "textarea" | "select" | "multiselect" | "file";

export interface Field {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
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

  useEffect(() => {
    if (open) {
      const seed: Record<string, any> = {};
      fields.forEach((f) => {
        const init = (initial as any)?.[f.name];
        if (f.type === "multiselect") seed[f.name] = Array.isArray(init) ? init : [];
        else if (f.type === "file") seed[f.name] = init ?? null;
        else seed[f.name] = init ?? (f.type === "number" ? 0 : "");
      });
      setValues(seed);
      setErrors({});
    }
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    for (const f of fields) {
      // Skip validation for fields hidden by visibleWhen
      if (f.visibleWhen) {
        const v = values[f.visibleWhen.field];
        const want = f.visibleWhen.equals;
        const ok = Array.isArray(want) ? want.includes(v) : v === want;
        if (!ok) continue;
      }
      const v = values[f.name];
      if (f.type === "multiselect") {
        const min = f.minSelected ?? (f.required ? 1 : 0);
        if (min > 0 && (!Array.isArray(v) || v.length < min)) {
          errs[f.name] = `Select at least ${min} option${min === 1 ? "" : "s"}`;
        }
      } else if (f.type === "file") {
        if (f.required && !v) errs[f.name] = "File is required";
      } else if (f.required && (v === "" || v == null)) {
        errs[f.name] = `${f.label} is required`;
      }
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error(`Fix ${Object.keys(errs).length} field${Object.keys(errs).length === 1 ? "" : "s"} before saving`);
      return;
    }
    onSubmit(values as T);
    toast.success(`${title.replace(/^(Create|New|Edit) /, "")} saved`);
    setOpen(false);
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
                      onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                      className="bg-card/60"
                    />
                  ) : f.type === "select" ? (
                    <Select
                      value={values[f.name] ?? ""}
                      onValueChange={(val) => setValues((v) => ({ ...v, [f.name]: val }))}
                    >
                      <SelectTrigger className="bg-card/60">
                        <SelectValue placeholder={f.placeholder ?? "Select…"} />
                      </SelectTrigger>
                      <SelectContent>
                        {f.options?.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
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
                      type={f.type === "number" ? "number" : "text"}
                      value={values[f.name] ?? ""}
                      placeholder={f.placeholder}
                      onChange={(e) =>
                        setValues((v) => ({
                          ...v,
                          [f.name]: f.type === "number" ? Number(e.target.value) : e.target.value,
                        }))
                      }
                      className={`bg-card/60 ${errors[f.name] ? "border-destructive/60" : ""}`}
                    />
                  )}
                </div>
                {errors[f.name] && (
                  <div className="mt-1 text-[11px] text-destructive">{errors[f.name]}</div>
                )}
              </div>
            );
          })}
          <DialogFooter className="col-span-2 mt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-border/60 bg-card/60 px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-gradient-to-br from-primary to-info px-4 py-2 text-sm font-medium text-primary-foreground shadow-[var(--shadow-glow)]"
            >
              {submitLabel}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
