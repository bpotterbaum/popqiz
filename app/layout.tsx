import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Popqiz - Real-time Trivia",
  description: "Zero-setup, real-time trivia game for short, social moments",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

