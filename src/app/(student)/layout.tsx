import Header from "@/components/layout/Header";
import { requireRole } from "@/lib/auth";
import Footer from "@/components/layout/Footer";
import { DemoNotice } from "@/components/workspace/WorkspaceUI";
import { USE_MOCKS } from "@/lib/services/errors";

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
        {USE_MOCKS && <DemoNotice />}
        {children}
      </main>
      <Footer />
    </>
  );
}
