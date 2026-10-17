import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Expand, Grid2X2, StickyNote, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScaledSlide } from "@/components/presentation/ScaledSlide";
import { DeckSlide, deckSlides } from "@/components/presentation/DeckSlides";
import { getOverviewProof } from "@/lib/overview.functions";

const proofQuery = queryOptions({ queryKey: ["overview-proof"], queryFn: () => getOverviewProof(), staleTime: 0 });
export const Route = createFileRoute("/presentation")({
  validateSearch: (search: Record<string, unknown>) => ({ slide: Math.max(1, Math.min(deckSlides.length, Number(search.slide) || 1)), print: search.print === true || search.print === "true" }),
  head: () => ({ meta: [
    { title: "LogAirlock — Project Presentation" },
    { name: "description", content: "Present LogAirlock’s prompt-injection containment, analyst workflow, stored benchmark evidence and honest limitations." },
    { property: "og:title", content: "LogAirlock — Project Presentation" },
    { property: "og:description", content: "A presentation of the trust boundary between attacker-controlled logs and AI SOC triage." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(proofQuery),
  component: Presentation,
});

function Presentation() {
  const { data: proof } = useSuspenseQuery(proofQuery);
  const { slide, print } = Route.useSearch();
  const navigate = Route.useNavigate();
  const index = slide - 1;
  const [grid, setGrid] = useState(false);
  const [notes, setNotes] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const touch = useRef<number | null>(null);
  const go = (next: number) => navigate({ search: { slide: Math.max(1, Math.min(deckSlides.length, next + 1)), print: false }, replace: true });
  useEffect(() => {
    document.title = `${slide}/${deckSlides.length} — ${deckSlides[index]?.title ?? "LogAirlock"}`;
  }, [index, slide]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (print || e.altKey || e.ctrlKey || e.metaKey) return;
      if (["ArrowRight", " ", "ArrowLeft"].includes(e.key)) {
        e.preventDefault();
        void go(index + (e.key === "ArrowLeft" ? -1 : 1));
      }
      if (e.key === "Escape") { setPresenting(false); setGrid(false); }
    };
    const change = () => { if (!document.fullscreenElement) setPresenting(false); };
    window.addEventListener("keydown", handler);
    document.addEventListener("fullscreenchange", change);
    return () => { window.removeEventListener("keydown", handler); document.removeEventListener("fullscreenchange", change); };
  }, [index, print]);
  async function present() {
    setGrid(false); setPresenting(true);
    try { await document.documentElement.requestFullscreen(); } catch { /* Inline presenting remains available. */ }
  }
  if (print) return <div className="deck-print"><div className="deck-print-toolbar flex items-center gap-4 p-4"><Button onClick={() => window.print()}><Printer />Save as PDF</Button><Button asChild variant="outline"><Link to="/presentation" search={{ slide, print: false }}>Back to deck</Link></Button></div>{deckSlides.map((_, i) => <DeckSlide key={i} index={i} proof={proof} />)}</div>;
  return <div className={`deck-page ${presenting ? "deck-presenting" : ""}`}>
    <div className="deck-toolbar"><div className="flex items-center gap-4"><Button asChild variant="ghost" size="icon" title="Back to LogAirlock"><Link to="/overview" aria-label="Back to LogAirlock"><ArrowLeft /></Link></Button><div><h1 className="text-sm font-semibold">LogAirlock</h1><p className="text-xs text-muted-foreground">Project presentation</p></div></div><div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" title="All slides" aria-label="All slides" onClick={() => setGrid(!grid)}><Grid2X2 /></Button>
      <Button variant="ghost" size="icon" title="Presenter notes" aria-label="Presenter notes" onClick={() => setNotes(!notes)}><StickyNote /></Button>
      <Button asChild variant="ghost" size="icon" title="PDF print view"><Link to="/presentation" search={{ slide, print: true }} aria-label="PDF print view"><Printer /></Link></Button>
      <Button onClick={present} size="sm"><Expand />Present</Button>
    </div></div>
    {grid ? <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-auto p-6 sm:grid-cols-2 lg:grid-cols-3">{deckSlides.map((s, i) => <Button key={s.title} variant="outline" className="h-auto flex-col items-stretch p-0" onClick={() => { void go(i); setGrid(false); }}><div className="aspect-video w-full"><ScaledSlide><DeckSlide index={i} proof={proof} /></ScaledSlide></div><span className="truncate border-t p-3 text-left text-xs">{i+1}. {s.title}</span></Button>)}</div> : <div className="deck-stage" onTouchStart={e => { touch.current = e.touches[0]?.clientX ?? null; }} onTouchEnd={e => { const end = e.changedTouches[0]?.clientX; if (touch.current !== null && end !== undefined && Math.abs(end-touch.current)>45) void go(index+(end<touch.current?1:-1)); touch.current=null; }}><ScaledSlide><DeckSlide index={index} proof={proof} /></ScaledSlide></div>}
    <div className="deck-bottom border-t bg-background"><div className="flex items-center justify-between gap-4 px-5 py-3"><p className="truncate text-sm text-muted-foreground">{deckSlides[index]?.title}</p><div className="flex shrink-0 items-center gap-3"><Button variant="ghost" size="icon" aria-label="Previous slide" disabled={index===0} onClick={() => go(index-1)}><ArrowLeft /></Button><span className="text-xs tabular-nums">{slide} / {deckSlides.length}</span><Button variant="ghost" size="icon" aria-label="Next slide" disabled={slide===deckSlides.length} onClick={() => go(index+1)}><ArrowRight /></Button></div></div>{notes && <section className="max-h-40 overflow-auto border-t px-5 py-4"><h2 className="mb-2 text-xs font-semibold">Presenter notes</h2><p className="max-w-4xl text-sm leading-relaxed text-muted-foreground">{deckSlides[index]?.notes}</p></section>}</div>
    {presenting && <Button className="fixed right-4 top-4" variant="outline" size="icon" aria-label="Exit presentation" onClick={() => { setPresenting(false); if(document.fullscreenElement) void document.exitFullscreen(); }}><X /></Button>}
  </div>;
}