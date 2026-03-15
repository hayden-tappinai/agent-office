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
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
