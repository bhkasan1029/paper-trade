import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { TopSearch } from "@/components/top-search";
import { LayoutShell } from "@/components/layout-shell";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PaperTrade",
  description: "Personal paper trading & portfolio tracking",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex bg-background text-foreground text-[15px]">
        <LayoutShell sidebar={<Sidebar />} topSearch={<TopSearch />}>
          {children}
        </LayoutShell>
        <Toaster />
      </body>
    </html>
  );
}
