import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tracer",
  description: "Radar transaksi insider IDX",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // never disable zoom — ui-ux-pro-max `viewport-meta`
  maximumScale: 5,
  themeColor: "#020617",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id">
      <head>
        {/* ui-ux-pro-max typography: Fira Sans + Fira Code (dashboard/data pairing) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}