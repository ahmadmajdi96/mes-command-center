export function toolState(t: any) {
  if (t.status !== "active") return { label: t.status.replace("_", " "), cls: "text-destructive", ok: false };
  if (t.calibration_due && new Date(t.calibration_due) < new Date(new Date().toDateString())) return { label: "calibration expired", cls: "text-destructive", ok: false };
  if (t.max_uses && t.uses >= t.max_uses) return { label: "use limit reached", cls: "text-destructive", ok: false };
  if (t.calibration_due && (new Date(t.calibration_due).getTime() - Date.now()) / 86_400_000 <= 14) return { label: "calibration due soon", cls: "text-warning", ok: true };
  return { label: "ready", cls: "text-success", ok: true };
}
