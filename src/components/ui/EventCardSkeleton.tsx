import Card from "@/components/ui/Card";

export default function EventCardSkeleton() {
  return (
    <Card className="h-full animate-pulse space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="h-6 w-2/3 rounded bg-black/10" />
        <div className="h-6 w-16 rounded-full bg-black/10" />
      </div>
      <div className="h-4 w-full rounded bg-black/10" />
      <div className="h-4 w-4/5 rounded bg-black/10" />
      <div className="flex justify-between gap-2">
        <div className="h-4 w-1/3 rounded bg-black/10" />
        <div className="h-4 w-1/4 rounded bg-black/10" />
      </div>
      <div className="h-4 w-1/4 rounded bg-black/10" />
    </Card>
  );
}