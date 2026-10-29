export default function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-card border border-border bg-white p-4 shadow-card ${className}`}
    >
      {children}
    </div>
  );
}