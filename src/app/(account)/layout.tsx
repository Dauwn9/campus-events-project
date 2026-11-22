import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { DemoNotice } from "@/components/workspace/WorkspaceUI";

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
