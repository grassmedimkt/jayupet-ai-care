import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JAYU PET AI 케어",
  description: "사진으로 시작하는 반려동물 맞춤 케어 경험",
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
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}

