import type { Metadata } from "next";
import "./globals.css";
import LocaleProvider from "@/components/LocaleProvider";

export const metadata: Metadata = {
  title: "LocaleKit",
  description: "AI-powered i18n translator",
  icons: {
    icon: [{ url: "/favicon.ico" }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-transparent dark">
      <body className="bg-transparent text-foreground antialiased">
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
