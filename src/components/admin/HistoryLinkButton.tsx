import Link from "next/link";

export type HistoryLinkButtonProps = {
  entityType: "EVENT" | "CATEGORY" | "USER";
  entityId: string;
  className?: string;
  title?: string;
};

const historySvg = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M3 12a9 9 0 1 0 3-6.7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 4v5h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 7v5l3.5 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function HistoryLinkButton({
  entityType,
  entityId,
  className = "",
  title = "История изменений",
}: HistoryLinkButtonProps) {
  const href = new URL("/admin/history", "http://localhost");
  href.searchParams.set("type", entityType.toLowerCase());
  href.searchParams.set("entityId", entityId);

  return (
    <Link
      href={`${href.pathname}${href.search}`}
      className={`history-link-button ${className}`.trim()}
      title={title}
      aria-label={`${title}: ${entityId}`}
    >
      {historySvg}
    </Link>
  );
}
