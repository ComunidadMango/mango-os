import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Providers from "@/components/Providers";

const batica = localFont({
  src: [
    { path: "./fonts/baticasans-regular.otf", weight: "400", style: "normal" },
    { path: "./fonts/baticasans-bold.otf", weight: "700", style: "normal" },
  ],
  variable: "--font-batica",
  display: "swap",
});

const satoshi = localFont({
  src: [
    { path: "./fonts/Satoshi-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Satoshi-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/Satoshi-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-satoshi",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mango OS",
  description: "El sistema operativo del equipo de Mango",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${batica.variable} ${satoshi.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
