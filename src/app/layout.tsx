import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Control Room",
  description:
    "Internal fintech operations platform for KYC reviews, refunds, and feature flags.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  return (
    <html lang="en">
      <body className="min-h-screen bg-page font-sans text-body text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
