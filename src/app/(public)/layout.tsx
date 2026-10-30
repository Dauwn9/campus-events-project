import Header from "@/components/layout/Header";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
     <main className="mx-auto max-w-6xl p-6">{children}</main>
    </>
  );
}