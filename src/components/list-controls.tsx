import { useEffect, useMemo, useState } from "react";
import { Download, Search, ChevronLeft, ChevronRight } from "lucide-react";

export const PAGE_SIZES = [50, 75, 100, 150, 200] as const;

type Opts<T> = {
  /** Fields searched by the text box. */
  searchKeys?: (keyof T)[];
  /** Field holding the created/recorded time. */
  dateKey?: keyof T;
  /** File name for exports. */
  exportName?: string;
};

function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function cell(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function exportRows(rows: Record<string, unknown>[], name: string, kind: "csv" | "xls") {
  const cols = Array.from(rows.reduce((s, r) => { Object.keys(r).forEach((k) => s.add(k)); return s; }, new Set<string>()));
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  if (kind === "csv") {
    const esc = (s: string) => /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    const body = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(cell(r[c]))).join(","))].join("\n");
    download(`${name}-${stamp}.csv`, "\uFEFF" + body, "text/csv;charset=utf-8");
  } else {
    const h = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const html = `<html><head><meta charset="utf-8"></head><body><table border="1"><tr>${cols.map((c) => `<th>${h(c)}</th>`).join("")}</tr>${rows.map((r) => `<tr>${cols.map((c) => `<td>${h(cell(r[c]))}</td>`).join("")}</tr>`).join("")}</table></body></html>`;
    download(`${name}-${stamp}.xls`, html, "application/vnd.ms-excel");
  }
}

/** Search, created date/time range, page size (50/75/100/150/200), paging and CSV/Excel export for any list. */
export function useListControls<T extends object>(rows: T[], opts: Opts<T> = {}) {
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [size, setSize] = useState<number>(50);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const f = from ? new Date(from).getTime() : null;
    const t = to ? new Date(to).getTime() : null;
    return rows.filter((r) => {
      const rec = r as Record<string, unknown>;
      if (opts.dateKey && (f != null || t != null)) {
        const raw = rec[opts.dateKey as string];
        const ts = raw ? new Date(raw as string).getTime() : NaN;
        if (Number.isNaN(ts)) return false;
        if (f != null && ts < f) return false;
        if (t != null && ts > t) return false;
      }
      if (!s) return true;
      const keys = (opts.searchKeys as string[] | undefined) ?? Object.keys(rec);
      return keys.some((k) => cell(rec[k]).toLowerCase().includes(s));
    });
  }, [rows, q, from, to, opts.dateKey, opts.searchKeys]);

  useEffect(() => { setPage(0); }, [q, from, to, size, rows.length]);

  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const cur = Math.min(page, pages - 1);
  const visible = filtered.slice(cur * size, cur * size + size);

  const quick = (ms: number | "today") => {
    const now = new Date();
    const start = ms === "today" ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : new Date(now.getTime() - ms);
    setFrom(toLocalInput(start)); setTo("");
  };

  const inputCls = "h-9 rounded-lg border border-border/60 bg-card/60 px-2 text-xs focus:border-primary/50 focus:outline-none";
  const btnCls = "flex h-9 items-center gap-1 rounded-lg border border-border/60 bg-card/60 px-2.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40";

  const toolbar = (
    <div className="glass-panel flex flex-wrap items-center gap-2 rounded-2xl p-3">
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" aria-label="Search list" className={`${inputCls} w-full pl-8`} />
      </div>
      {opts.dateKey && (
        <>
          <label className="flex items-center gap-1 text-[11px] text-muted-foreground">From
            <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} aria-label="Created from" />
          </label>
          <label className="flex items-center gap-1 text-[11px] text-muted-foreground">To
            <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} aria-label="Created to" />
          </label>
          <select className={inputCls} value="" aria-label="Quick range" onChange={(e) => {
            const v = e.target.value;
            if (v === "1h") quick(3600e3); else if (v === "today") quick("today");
            else if (v === "7d") quick(7 * 864e5); else if (v === "30d") quick(30 * 864e5);
            else if (v === "clear") { setFrom(""); setTo(""); }
          }}>
            <option value="">Quick range…</option>
            <option value="1h">Last hour</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="clear">Clear dates</option>
          </select>
        </>
      )}
      <select className={inputCls} value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label="Rows per page">
        {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} / page</option>)}
      </select>
      <button className={btnCls} onClick={() => exportRows(filtered as Record<string, unknown>[], opts.exportName ?? "export", "csv")} disabled={!filtered.length}>
        <Download className="h-3.5 w-3.5" /> CSV
      </button>
      <button className={btnCls} onClick={() => exportRows(filtered as Record<string, unknown>[], opts.exportName ?? "export", "xls")} disabled={!filtered.length}>
        <Download className="h-3.5 w-3.5" /> Excel
      </button>
    </div>
  );

  const pager = (
    <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
      <span>{filtered.length ? `${cur * size + 1}–${Math.min(filtered.length, (cur + 1) * size)} of ${filtered.length}` : "0 results"}{filtered.length !== rows.length ? ` (filtered from ${rows.length})` : ""}</span>
      <div className="flex items-center gap-1">
        <button className={btnCls} disabled={cur === 0} onClick={() => setPage(cur - 1)} aria-label="Previous page"><ChevronLeft className="h-3.5 w-3.5" /></button>
        <span>Page {cur + 1} / {pages}</span>
        <button className={btnCls} disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} aria-label="Next page"><ChevronRight className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );

  return { filtered, visible, toolbar, pager };
}
