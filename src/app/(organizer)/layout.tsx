import Header from "@/components/layout/Header";
import { requireRole } from "@/lib/auth";

export default async function OrganizerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("ORGANIZER");
  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </>
  );
}