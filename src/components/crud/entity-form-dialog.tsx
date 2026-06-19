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

export type FieldType = "text" | "number" | "textarea" | "select";

export interface Field {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  span?: 1 | 2;
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

  useEffect(() => {
    if (open) {
      const seed: Record<string, any> = {};
      fields.forEach((f) => {
        seed[f.name] = (initial as any)?.[f.name] ?? (f.type === "number" ? 0 : "");
      });
      setValues(seed);
    }
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    for (const f of fields) {
      if (f.required && (values[f.name] === "" || values[f.name] == null)) {
        toast.error(`${f.label} is required`);
        return;
      }
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
                      className="bg-card/60"
                    />
                  )}
                </div>
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
