import Skeleton from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-6" aria-busy="true">
      <Skeleton className="mb-6 h-8 w-40" />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <li key={i}>
            <Skeleton className="h-36 rounded-xl" />
          </li>
        ))}
      </ul>
    </main>
  );
}
