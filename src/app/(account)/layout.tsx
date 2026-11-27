import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { DemoNotice } from "@/components/workspace/WorkspaceUI";
import { USE_MOCKS } from "@/lib/services/errors";

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
