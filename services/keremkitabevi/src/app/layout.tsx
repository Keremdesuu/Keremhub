import type { Metadata, Viewport } from "next";
import Header from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Kerem Kitabevi", template: "%s · Kerem Kitabevi" },
  description: "Evdeki e-kitap arşivi: yazara, seriye ve türe göre bul, tarayıcıda oku, indir.",
  applicationName: "Kerem Kitabevi",
};

export const viewport: Viewport = {
  themeColor: "#0c1022",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-dvh">
        <Header />
        {children}
        <footer className="mt-24 border-t border-line/70 py-8 text-center text-sm text-muted">
          Kerem Kitabevi · Keremhub sitelerinden biri
        </footer>
      </body>
    </html>
  );
}
