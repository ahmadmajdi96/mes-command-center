import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ChevronRight, FileText, Maximize2, Printer, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { documentation, type DocSection } from "@/lib/documentation";
import orders from "@/assets/documentation/orders.webp.asset.json";
import execution from "@/assets/documentation/execution.webp.asset.json";
import scheduling from "@/assets/documentation/scheduling.webp.asset.json";
import wip from "@/assets/documentation/wip.webp.asset.json";
import lots from "@/assets/documentation/lots.webp.asset.json";
import approvals from "@/assets/documentation/approvals.webp.asset.json";
import machines from "@/assets/documentation/machines.webp.asset.json";
import reports from "@/assets/documentation/reports.webp.asset.json";
import portals from "@/assets/documentation/portals.webp.asset.json";
import roles from "@/assets/documentation/roles.webp.asset.json";
import downtime from "@/assets/documentation/downtime.webp.asset.json";
import instructions from "@/assets/documentation/instructions.webp.asset.json";

const screenshots: Record<string, { url: string }> = { orders, execution, scheduling, wip, lots, approvals, machines, reports, portals, roles, downtime, instructions };
const categories = ["Foundations", "Production workflows", "Technical reference"];

export const Route = createFileRoute("/_authenticated/documentation")({
  head: () => ({ meta: [
    { title: "Technical Documentation — Cortanex MES" },
    { name: "description", content: "Cortanex MES technical guide: architecture, illustrated workflows, data model, integration contracts, security and operating procedures." },
    { property: "og:title", content: "Technical Documentation — Cortanex MES" },
    { property: "og:description", content: "A detailed technical and operational reference with actual application screenshots and workflow diagrams." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: DocumentationPage,
});

function Workflow({ nodes }: { nodes: string[] }) {
  return <div className="my-7 border-y border-border py-5">
    <h3 className="mb-4 font-mono text-xs uppercase text-muted-foreground">Workflow</h3>
    <ol className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center" aria-label="Workflow diagram">
      {nodes.map((node, i) => <li key={node} className="flex min-w-0 items-center gap-3">
        <div className="flex min-h-12 max-w-48 items-center gap-2 rounded-md border border-primary/25 bg-primary/5 px-3 py-2">
          <span className="font-mono text-xs text-primary">{String(i + 1).padStart(2, "0")}</span><span className="text-xs font-medium">{node}</span>
        </div>
        {i < nodes.length - 1 && <><ArrowRight aria-hidden className="hidden size-4 shrink-0 text-muted-foreground sm:block"/><ArrowDown aria-hidden className="size-4 shrink-0 text-muted-foreground sm:hidden"/></>}
      </li>)}
    </ol>
  </div>;
}

function Chapter({ section, number, onImage }: { section: DocSection; number: number; onImage: (section: DocSection) => void }) {
  const asset = section.screenshot ? screenshots[section.screenshot] : undefined;
  return <article id={section.id} className="doc-chapter min-w-0 scroll-mt-20" aria-labelledby={`title-${section.id}`}>
    <div className="mb-4 flex items-center gap-2 font-mono text-xs text-muted-foreground"><span className="text-primary">{String(number).padStart(2, "0")}</span><ChevronRight className="size-3"/>{section.category}</div>
    <h2 id={`title-${section.id}`} className="text-2xl font-semibold sm:text-3xl">{section.title}</h2>
    <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">{section.summary}</p>
    {section.paragraphs?.map(p => <p key={p} className="mt-5 text-sm leading-7">{p}</p>)}
    {section.prerequisites && <div className="mt-7 border-l-2 border-info pl-4"><h3 className="mb-2 text-sm font-semibold">Before you begin</h3><ul className="space-y-2">{section.prerequisites.map(p=><li key={p} className="flex gap-2 text-sm leading-6 text-muted-foreground"><CheckCircle2 className="mt-1 size-4 shrink-0 text-info"/>{p}</li>)}</ul></div>}
    {section.flow && <Workflow nodes={section.flow}/>}
    {asset && <figure className="my-7">
      <div className="relative overflow-hidden rounded-md border border-border bg-card">
        <img src={asset.url} alt={`${section.title}: captured Cortanex MES application screen`} loading="eager" width={1024} height={900} className="h-auto w-full"/>
        <Button variant="secondary" size="icon" title="Enlarge screenshot" aria-label={`Enlarge ${section.title} screenshot`} onClick={()=>onImage(section)} className="absolute right-3 top-3 print:hidden"><Maximize2/></Button>
      </div>
      <figcaption className="mt-3 text-xs leading-5 text-muted-foreground">{section.caption}</figcaption>
      {section.annotations && <ol className="mt-4 grid gap-x-5 gap-y-3 sm:grid-cols-2">{section.annotations.map((a,i)=><li key={a} className="flex gap-2 text-xs leading-5"><span className="font-mono text-primary">{i+1}.</span>{a}</li>)}</ol>}
    </figure>}
    {section.steps && <div className="mt-8"><h3 className="mb-5 text-lg font-semibold">Step-by-step workflow</h3><ol className="space-y-6">{section.steps.map((step,i)=><li key={step.title} className="flex gap-4"><span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary font-mono text-xs text-primary">{i+1}</span><div className="min-w-0"><h4 className="text-sm font-semibold">{step.title}</h4><p className="mt-2 text-sm leading-7 text-muted-foreground">{step.body}</p></div></li>)}</ol></div>}
    {section.tables?.map(table=><div key={table.title} className="mt-8"><h3 className="mb-3 text-lg font-semibold">{table.title}</h3><div className="overflow-x-auto rounded-md border border-border"><table className="w-full min-w-[540px] text-left text-sm"><thead className="bg-secondary"><tr>{table.columns.map(c=><th key={c} className="px-4 py-3 text-xs font-semibold">{c}</th>)}</tr></thead><tbody>{table.rows.map((row,i)=><tr key={i} className="border-t border-border">{row.map((cell,j)=><td key={j} className={`px-4 py-3 align-top text-xs leading-6 ${j===0 ? "font-medium text-foreground" : "text-muted-foreground"}`}>{cell}</td>)}</tr>)}</tbody></table></div></div>)}
    {section.code?.map(code=><div key={code.title} className="mt-7"><h3 className="mb-2 text-sm font-semibold">{code.title}</h3><pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted p-4 font-mono text-xs leading-6">{code.text}</pre></div>)}
    {section.checks && <aside className="mt-8 border-l-2 border-warning pl-4"><h3 className="mb-2 text-sm font-semibold text-warning">Checks & limitations</h3><ul className="list-disc space-y-2 pl-4 text-sm leading-6 text-muted-foreground">{section.checks.map(c=><li key={c}>{c}</li>)}</ul></aside>}
  </article>;
}

function DocumentationPage() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("overview");
  const [mode, setMode] = useState<"chapter"|"all">("chapter");
  const [image, setImage] = useState<DocSection | null>(null);
  const normalized = query.trim().toLowerCase();
  const filtered = documentation.filter(s => JSON.stringify(s).toLowerCase().includes(normalized));
  const current = documentation.find(s=>s.id===selected) ?? documentation[0];
  const index = documentation.findIndex(s=>s.id===current?.id);
  const select = (id: string) => {setSelected(id); setMode("chapter"); window.scrollTo({top:0,behavior:"instant"});};
  const visible = mode === "all" ? filtered : current ? [current] : [];
  return <div className="technical-docs mx-auto max-w-[1600px]">
    <header className="doc-header mb-8 border-b border-border pb-6">
      <div className="mb-3 flex items-center gap-2 text-xs text-primary"><BookOpen className="size-4"/><span className="font-mono uppercase">Engineering & operations reference</span></div>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-semibold">Cortanex MES Documentation</h1><p className="mt-3 text-sm text-muted-foreground">Architecture, workflows, integration contracts and operating procedures.</p></div><Button onClick={()=>window.print()} variant="outline" className="print:hidden"><Printer/>Print / PDF</Button></div>
      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs text-muted-foreground"><span>Reviewed 12 Oct 2026</span><span>{documentation.length} chapters</span><span>12 actual screenshots</span><span className="text-warning">Implementation reference · not a commissioning certificate</span></div>
    </header>
    <div className="grid min-w-0 gap-8 lg:grid-cols-[250px_minmax(0,1fr)] xl:gap-12">
      <aside className="doc-navigation min-w-0 print:hidden"><div className="lg:sticky lg:top-20">
        <div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground"/><Input aria-label="Search documentation" placeholder="Search documentation…" value={query} onChange={e=>setQuery(e.target.value)} className="h-10 pl-9 pr-9"/>{query && <Button size="icon" variant="ghost" className="absolute right-1 top-1 size-8" onClick={()=>setQuery("")} aria-label="Clear documentation search"><X/></Button>}</div>
        <div className="mt-3 flex border-b border-border pb-3"><Button size="sm" variant={mode==="chapter"?"secondary":"ghost"} onClick={()=>setMode("chapter")} aria-pressed={mode==="chapter"}><BookOpen/>Chapter</Button><Button size="sm" variant={mode==="all"?"secondary":"ghost"} onClick={()=>setMode("all")} aria-pressed={mode==="all"}><FileText/>Full guide</Button></div>
        {query && <p className="mt-3 text-xs text-muted-foreground" role="status">{filtered.length} matching chapters</p>}
        <nav aria-label="Documentation chapters" className="mt-4 max-h-52 overflow-y-auto pr-1 lg:max-h-[65vh]">{categories.map(category=>{
          const items=filtered.filter(s=>s.category===category); if(!items.length)return null;
          return <div key={category} className="mb-5"><h2 className="mb-2 font-mono text-[10px] uppercase text-muted-foreground">{category}</h2>{items.map(section=><Button key={section.id} variant="ghost" onClick={()=>select(section.id)} aria-current={selected===section.id && mode==="chapter"?"page":undefined} className={`mb-1 h-auto min-h-9 w-full justify-start whitespace-normal py-2 text-left text-xs leading-5 ${selected===section.id && mode==="chapter"?"border-l-2 border-primary bg-primary/10 text-primary":"text-muted-foreground"}`}><span className="w-5 shrink-0 font-mono text-[10px]">{String(documentation.indexOf(section)+1).padStart(2,"0")}</span>{section.title}</Button>)}</div>;
        })}{filtered.length===0 && <div className="py-6 text-sm text-muted-foreground">No matching chapters. Try an order, lot, portal or permission topic.</div>}</nav>
      </div></aside>
      <div className="min-w-0 max-w-[1080px]">
        <div className="doc-visible space-y-16">{visible.map(section=><Chapter key={section.id} section={section} number={documentation.indexOf(section)+1} onImage={setImage}/>)}{visible.length===0 && <p className="py-12 text-muted-foreground">No chapters match this search.</p>}</div>
        <div className="doc-print-only hidden space-y-16">{documentation.map((section,i)=><Chapter key={section.id} section={section} number={i+1} onImage={setImage}/>)}</div>
        {mode==="chapter" && <footer className="mt-12 flex flex-wrap justify-between gap-3 border-t border-border pt-5 print:hidden"><Button variant="ghost" disabled={index<=0} onClick={()=>{const prev=documentation[index-1];if(prev)select(prev.id);}}><ArrowLeft/>Previous chapter</Button><Button variant="outline" disabled={index>=documentation.length-1} onClick={()=>{const next=documentation[index+1];if(next)select(next.id);}}>Next chapter<ArrowRight/></Button></footer>}
        <p className="mt-10 border-t border-border py-5 text-xs leading-5 text-muted-foreground">Cortanex MES · Technical reference · Screenshots use demonstration records. No credentials are included.</p>
      </div>
    </div>
    <Dialog open={Boolean(image)} onOpenChange={open=>{if(!open)setImage(null);}}><DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto bg-background" aria-describedby="documentation-image-caption"><DialogHeader><DialogTitle>{image?.title}</DialogTitle></DialogHeader>{image?.screenshot && screenshots[image.screenshot] && <img src={screenshots[image.screenshot]?.url} alt={`${image.title} enlarged application screenshot`} className="h-auto w-full rounded-md"/>}<p id="documentation-image-caption" className="text-xs leading-5 text-muted-foreground">{image?.caption}</p></DialogContent></Dialog>
  </div>;
}