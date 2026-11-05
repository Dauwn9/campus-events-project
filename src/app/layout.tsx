import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import DevRoleSwitcher from "@/components/layout/DevRoleSwitcher";
import { ToastProvider } from "@/components/ui/Toast";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "AIU Campus Events — жизнь за пределами пар",
  description: "События Международного университета Астана: лекции, музыка, искусство и карьера. Найди своё событие в AIU.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  return (
    <html lang="ru">
      <body className={inter.variable}>
        <a className="skip-link" href="#main-content">Перейти к содержимому</a>
        <ToastProvider>{children}</ToastProvider>
        {process.env.NEXT_PUBLIC_USE_MOCKS!=="false"&&<DevRoleSwitcher current={user.role} />}
      </body>
    </html>
  );
}
