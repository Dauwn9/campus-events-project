import Header from "@/components/layout/Header";
import AdminSidebar from "@/components/layout/AdminSidebar";
import { requireRole } from "@/lib/auth";
import Footer from "@/components/layout/Footer";
import { DemoNotice } from "@/components/workspace/WorkspaceUI";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("ADMIN");
  return (
    <>
      <Header />
      <div className="page-container admin-workspace">
        <AdminSidebar />
        <main className="workspace admin-main" id="main-content"><DemoNotice/>{children}</main>
      </div>
      <Footer/>
    </>
  );
}
