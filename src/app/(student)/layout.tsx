import Header from "@/components/layout/Header";
import { requireRole } from "@/lib/auth";
import Footer from "@/components/layout/Footer";
import { DemoNotice } from "@/components/workspace/WorkspaceUI";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("STUDENT");
  return (
    <>
      <Header />
      <main className="page-container workspace" id="main-content">
        <DemoNotice />
        {children}
      </main>
      <Footer />
    </>
  );
}
