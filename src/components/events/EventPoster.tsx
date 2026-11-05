import { getEventTheme } from "@/lib/event-design";
export default function EventPoster({ categoryId, large = false }: { categoryId: string; large?: boolean }) {
  const design = getEventTheme(categoryId);
  return <div className={`event-poster poster-${design.theme}${large ? " poster-large" : ""}`} aria-hidden="true"><span className="poster-overline">AIU <span>CAMPUS CULTURE</span></span><span className="poster-symbol">{design.symbol}</span><span className="poster-headline">{design.headline}</span><span className="poster-subline">{design.subline}<span>2026 / 27</span></span><span className="poster-orbit" /></div>;
}
