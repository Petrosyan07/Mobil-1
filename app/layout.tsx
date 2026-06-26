import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "М1 / Mobil 1 Центр",
  description: "Ежедневный журнал автосервиса"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
