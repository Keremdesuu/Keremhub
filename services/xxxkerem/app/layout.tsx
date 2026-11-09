import type { Metadata } from "next";
import "./globals.css";
import PhotoFullscreenBoundary from "@/components/PhotoFullscreenBoundary";
import Header from "@/components/Header";

const A = process.env.NEXT_PUBLIC_SITE_NAME_A ?? "Site";
const B = process.env.NEXT_PUBLIC_SITE_NAME_B ?? "Adı";

export const metadata: Metadata = {
  title: `${A}${B}`,
  description: "Kişisel video ve fotoğraf arşivi",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <PhotoFullscreenBoundary />
        <Header />
        <main className="mx-auto w-full max-w-[1500px] px-4 pb-16 pt-5 sm:px-6">{children}</main>
        <footer className="border-t border-panel py-6 text-center text-xs text-muted">
          Yerel ağ arşivi · {A}
          {B}
        </footer>
      </body>
    </html>
  );
}
