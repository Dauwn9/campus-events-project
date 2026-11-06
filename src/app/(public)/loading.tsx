import EventCardSkeleton from "@/components/ui/EventCardSkeleton";

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <h1 className="text-2xl font-bold">Афиша</h1>
      <div className="h-10 animate-pulse rounded-lg bg-black/10" />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <EventCardSkeleton key={i} />
        ))}
      </div>
      <span className="sr-only">Загрузка афиши…</span>
    </div>
  );
}