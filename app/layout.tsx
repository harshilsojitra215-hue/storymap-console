import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Storymap Editor Console",
  description:
    "A split-pane prototype: edit a map-driven story chapter and see the result live, with no reload between editing and checking.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <head>
        {/* The map preview fetches its style and tiles from here on first
            paint. Opening the connection early — DNS, TLS, TCP — before the
            map library has even finished downloading shaves that latency off
            the moment tiles start arriving. Font preconnects belong here too,
            once the design pass adds Google Fonts. */}
        <link rel="preconnect" href="https://tiles.openfreemap.org" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://tiles.openfreemap.org" />
        <link rel="dns-prefetch" href="https://demotiles.maplibre.org" />
      </head>
      <body>
        {children}
        {/* The script it injects only exists on Vercel's own infrastructure —
            `VERCEL` is a system env var Vercel sets automatically at build and
            runtime. Rendering it unconditionally would 404 on every local
            `next build && next start`, which is exactly how this project's own
            acceptance checks run before each deploy. */}
        {process.env.VERCEL === "1" && <SpeedInsights />}
      </body>
    </html>
  );
}
