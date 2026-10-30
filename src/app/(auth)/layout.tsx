export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface">
      <div className="w-full max-w-sm rounded-card bg-white p-6 shadow-card">
        {children}
      </div>
    </main>
  );
}