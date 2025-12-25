import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Document Summarizer V2",
  description: "Compare Claude and OpenAI document summaries side-by-side",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-gray-900 text-white">{children}</body>
    </html>
  );
}

