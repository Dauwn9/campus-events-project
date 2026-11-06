import Skeleton from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6" aria-busy="true">
      <Skeleton className="mb-6 h-8 w-56" />
      <ul className="space-y-3">
        {[1, 2, 3].map((i) => (
          <li key={i}>
            <Skeleton className="h-28 rounded-xl" />
          </li>
        ))}
      </ul>
    </main>
  );
}
