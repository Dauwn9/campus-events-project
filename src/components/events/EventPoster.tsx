import { getEventTheme } from "@/lib/event-design";

export default function EventPoster({
  categoryId,
  title,
  imageUrl,
  large = false,
}: {
  categoryId: string;
  title: string;
  imageUrl?: string;
  large?: boolean;
}) {
  const design = getEventTheme(categoryId);
  const eventTitle = title.trim();
  const headline = eventTitle
    ? eventTitle.replace(/\s+/g, " ").toLocaleUpperCase("ru")
    : design.headline;

  return (
    <div
      className={`event-poster poster-${design.theme}${large ? " poster-large" : ""}${imageUrl ? " poster-with-image" : ""}`}
      aria-hidden="true"
    >
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="poster-cover-image" src={imageUrl} alt="" />
      )}
      <span className="poster-overline">
        AIU <span>CAMPUS CULTURE</span>
      </span>
      <span className="poster-symbol">{design.symbol}</span>
      <span
        className={`poster-headline${eventTitle ? " poster-event-title" : ""}`}
      >
        {headline}
      </span>
      <span className="poster-subline">
        {design.subline}
        <span>2026 / 27</span>
      </span>
      <span className="poster-orbit" />
    </div>
  );
}
