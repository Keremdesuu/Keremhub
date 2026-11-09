import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque/wdth.css";
import "@fontsource-variable/instrument-sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "Keremhub · Kişisel alanın",
  description: "Uygulamaların ve Raspberry Pi, tek bir kişisel alanda.",
};

export const viewport: Viewport = {
  themeColor: "#171724",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
