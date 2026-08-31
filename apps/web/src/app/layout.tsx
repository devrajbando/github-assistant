import type { Metadata } from "next";
import { Space_Mono, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import LiveClock from "@/components/LiveClock";

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "GitHub Assistant — Repository Intelligence",
  description:
    "AI-powered sync, chat, and code review for your GitHub repositories.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${spaceMono.variable} ${plexMono.variable} ${plexSans.variable} h-full antialiased`}
    >
      <body className="crt-boot relative flex min-h-full flex-col overflow-x-hidden bg-console font-body text-paper">
        <div
          className="scanlines pointer-events-none fixed inset-0 z-50"
          aria-hidden="true"
        />
        <div
          className="crt-vignette pointer-events-none fixed inset-0 z-40"
          aria-hidden="true"
        />

        <div className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-panel-border bg-console/90 px-6 py-3 font-mono-ui text-xs backdrop-blur-sm sm:px-12">
          <div className="flex gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-amber" />
            <span className="h-2.5 w-2.5 rounded-full bg-phosphor" />
            <span className="h-2.5 w-2.5 rounded-full bg-rust" />
          </div>
          <div className="hidden text-paper-dim sm:block">
            user@mission-control:~/github-assistant$
          </div>
          <LiveClock />
        </div>

        <div className="flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}