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
        <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet" />
        <style>{`
          *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { width: 100vw; height: 100vh; overflow: hidden; background: #E0E0E0; }
          @keyframes dialogueSlideUp {
            from { transform: translateX(-50%) translateY(40px); opacity: 0; }
            to { transform: translateX(-50%) translateY(0); opacity: 1; }
          }
          @keyframes cursorBlink {
            0%, 49% { opacity: 1; }
            50%, 100% { opacity: 0; }
          }
          @keyframes backdropFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes interiorPop {
            from { transform: scale(0.9); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
          @keyframes skeletonShimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
      </head>
      <body style={{ margin: 0, padding: 0, overflow: "hidden", width: "100vw", height: "100vh" }}>{children}</body>
    </html>
  );
}
