import Card from "@/components/ui/Card";

const bar = "animate-pulse rounded bg-black/10";

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6" aria-busy="true">
      <div className={`h-4 w-24 ${bar}`} />
      <div className={`h-9 w-2/3 ${bar}`} />
      <div className="space-y-2">
        <div className={`h-4 w-full ${bar}`} />
        <div className={`h-4 w-full ${bar}`} />
        <div className={`h-4 w-3/4 ${bar}`} />
      </div>
      <Card className="grid gap-3 sm:grid-cols-2">
        <div className={`h-5 w-3/4 ${bar}`} />
        <div className={`h-5 w-2/3 ${bar}`} />
        <div className={`h-5 w-1/2 ${bar}`} />
      </Card>
      <span className="sr-only">Загрузка события…</span>
    </div>
  );
}