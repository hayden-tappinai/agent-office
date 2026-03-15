import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agent Office — WHYRE HQ",
  description: "A pixel art virtual office for 10 AI agents",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: "#0a0a0a", overflow: "hidden" }}>
        {children}
      </body>
    </html>
  );
}
