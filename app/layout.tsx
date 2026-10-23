import type { Metadata } from "next";
import "./globals.css";
import "@xyflow/react/dist/style.css";

import { THEME_INIT_SCRIPT } from "@/components/app-shell/theme";

// Loaded with a stylesheet link (as in the original design) so builds don't
// need to download fonts.
const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;650;700&family=JetBrains+Mono:wght@400;500;600&display=swap";

export const metadata: Metadata = {
  title: "CodeWiz",
  description:
    "Import a public GitHub repo, map its functions, and learn the important ones with quizzes and spot-the-bug drills.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS_URL} />
        {/* Apply the saved theme before first paint so dark mode doesn't flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <div className="min-h-[100dvh] bg-background text-foreground">
          {children}
        </div>
      </body>
    </html>
  );
}
