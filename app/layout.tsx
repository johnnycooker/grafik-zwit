// app/layout.tsx

import "./globals.css";
import type { Metadata } from "next";
import AppSessionProvider from "@/components/session-provider";
import AppActivityTracker from "@/components/app-activity-tracker";

export const metadata: Metadata = {
  title: "Grafik pracy",
  description: "Podgląd grafiku z Excela online",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body>
        <AppSessionProvider>
          <AppActivityTracker />
          {children}
        </AppSessionProvider>
      </body>
    </html>
  );
}
