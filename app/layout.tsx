import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Home Base",
  description: "Service management platform for vehicle service shops.",
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
            __html: `
              try {
                const theme = localStorage.getItem("hb_theme");
                const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                if (theme === "dark" || (!theme && prefersDark)) {
                  document.documentElement.classList.add("dark");
                }
              } catch {}
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
