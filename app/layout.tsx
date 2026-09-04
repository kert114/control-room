import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Control Room — KYC UI direction prototype",
  description: "Disposable UI direction prototype with synthetic demo data.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
