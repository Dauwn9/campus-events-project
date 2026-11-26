import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import Header from "@/components/layout/Header";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "AIU Campus Events — жизнь за пределами пар",
  description: "События Международного университета Астана: лекции, музыка, искусство и карьера. Найди своё событие в AIU.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className={inter.variable}>
        <a className="skip-link" href="#main-content">Перейти к содержимому</a>
        <Header />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
