import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "WHYRE Agent Office",
  description: "Pixel art virtual office — TappinAI's 10-agent team",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ margin: 0, padding: 0, overflow: "hidden", width: "100vw", height: "100vh" }}>
      <head>
        <style>{`
          *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { width: 100vw; height: 100vh; overflow: hidden; background: #E0E0E0; }
        `}</style>
      </head>
      <body style={{ margin: 0, padding: 0, overflow: "hidden", width: "100vw", height: "100vh" }}>{children}</body>
    </html>
  );
}
