import Link from "next/link";

export default function NoAccess() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">Нет доступа</h1>
      <p className="text-muted">У вашей роли нет прав на эту страницу.</p>
      <Link
        href="/"
        className="rounded-control bg-primary px-4 py-2 text-white hover:bg-primary-hover"
      >
        На главную
      </Link>
    </main>
  );
}