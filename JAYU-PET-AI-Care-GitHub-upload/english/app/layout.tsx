import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JAYU PET AI Care",
  description: "Personalized pet care that starts with a photo",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/asset/images/favicon.svg",
    shortcut: "/asset/images/favicon.svg",
  },
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


