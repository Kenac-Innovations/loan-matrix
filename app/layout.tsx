import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Providers } from "./providers";
import { Toaster } from "sonner";

const inter = Inter({ 
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Loan Matrix Dashboard",
  description: "Enterprise Needs Assessment and Configuration Dashboard",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans theme-transition`} suppressHydrationWarning>
        <ThemeProvider>
          <Providers>{children}</Providers>
          <Toaster 
            position="top-right"
            richColors
            closeButton
            duration={5000}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
