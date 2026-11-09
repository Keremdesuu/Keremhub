import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Keremflix",
  description: "Kerem'in kişisel dizi, film ve anime kütüphanesi",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-screen">
        <Navbar portalUrl={process.env.PORTAL_URL || "/"} />
        <main>{children}</main>
      </body>
    </html>
  );
}
