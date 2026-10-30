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
  title: "Campus Events",
  description: "Афиша студенческих событий",
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
        <ToastProvider>{children}</ToastProvider>
        <DevRoleSwitcher current={user.role} />
      </body>
    </html>
  );
}