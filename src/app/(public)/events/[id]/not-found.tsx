import Link from "next/link";
import EmptyState from "@/components/ui/EmptyState";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/" className="text-sm text-primary hover:underline">
        ← К афише
      </Link>
      <EmptyState
        title="Событие не найдено"
        text="Возможно, оно удалено или ссылка неверна."
      />
    </div>
  );
}