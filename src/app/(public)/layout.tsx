import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="page-container public-main" id="main-content">{children}</main>
      <Footer />
    </>
  );
}
