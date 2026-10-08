import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#090A0F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "SnapRoom // Ephemeral Lossless Vault",
  description: "Sıfır sıkıştırma, kayıpsız ortak anı kapsülü. 48 saat sonra uçar.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SnapRoom",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

import BackgroundAnimations from "@/components/BackgroundAnimations";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className="dark h-full bg-[#090A0F]">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-full bg-[#090A0F] text-[#F3F4F6] antialiased select-none">
        <BackgroundAnimations />
        {children}
      </body>
    </html>
  );
}
