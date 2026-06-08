import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cladtek Quality Inspector",
  description: "Cladtek Quality Inspector operation management system",
  icons: {
    icon: "/brand/cladtek-logo-icon.png",
  },
};

import { Providers } from "./providers";
import { Toaster } from "@/components/ui/sonner";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
