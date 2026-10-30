export default function EmptyState({
  title,
  text,
}: {
  title: string;
  text?: string;
}) {
  return (
    <div className="py-12 text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
      {text && <p className="mt-1 text-muted">{text}</p>}
    </div>
  );
}