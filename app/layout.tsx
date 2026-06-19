import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "GizOps — Zig's Kitchen Operations",
  description: "GizOps · Operations built for food truck operators · Zig's Kitchen",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('gizops-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
      </head>
      <body className="bg-coal text-cream antialiased">
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
